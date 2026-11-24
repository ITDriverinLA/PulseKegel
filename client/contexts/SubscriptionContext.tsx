import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesPackage,
} from "react-native-purchases";

import { GENERATED_ENV } from "@/lib/env-config.generated";
import type { OfferingsSurface, PaywallSource } from "@/lib/analytics";
import {
  PREMIUM_ENTITLEMENT_ID,
  hasPremium,
  parseStoredStatus,
} from "@/lib/premiumEntitlement";
import {
  createCustomerInfoApplier,
  loadOfferingsWith,
  runPurchase,
  runRestore,
  shouldRefreshOnForeground,
  type OfferingsLoadResult,
  type PurchaseOutcome,
  type RestoreOutcome,
} from "@/lib/purchaseFlow";

const STORAGE_KEYS = {
  INSTALL_DATE: "pulsekegel_install_date",
  SUBSCRIPTION_STATUS: "pulsekegel_subscription_status",
};

const TRIAL_DURATION_DAYS = 7;

const TEST_PAYWALL_MODE = false;

// P9b.5: last subscription status seen, so status changes log once.
const LAST_SUB_STATUS_KEY = "pulsekegel_last_subscription_status";

export { PREMIUM_ENTITLEMENT_ID, hasPremium };

export type PurchaseResult = PurchaseOutcome;
export type { RestoreOutcome };

interface SubscriptionContextType {
  isSubscribed: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  daysSinceInstall: number;
  isLoading: boolean;
  packages: PurchasesPackage[];
  purchasePackage: (
    pkg: PurchasesPackage,
    source?: PaywallSource,
  ) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<RestoreOutcome>;
  checkSubscription: () => Promise<void>;
  /** P9b.2: shared offerings loader (isConfigured gate + logging). */
  loadOfferings: (
    surface: OfferingsSurface,
  ) => Promise<OfferingsLoadResult<PurchasesPackage>>;
  /** P9b.5: refresh CustomerInfo on foreground (throttled to 60 s). */
  refreshOnForeground: () => Promise<void>;
  hasAccess: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: false,
  isTrialActive: true,
  trialDaysRemaining: TRIAL_DURATION_DAYS,
  daysSinceInstall: 0,
  isLoading: true,
  packages: [],
  purchasePackage: async () => "unavailable",
  restorePurchases: async () => "error",
  checkSubscription: async () => {},
  loadOfferings: async () => ({
    ok: false,
    reason: "not_configured",
    errorCode: "not_configured",
  }),
  refreshOnForeground: async () => {},
  hasAccess: true,
});

const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ||
  GENERATED_ENV.REVENUECAT_IOS_KEY ||
  "";
const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ||
  GENERATED_ENV.REVENUECAT_ANDROID_KEY ||
  "";

function platformApiKey(): string {
  return Platform.OS === "ios"
    ? REVENUECAT_API_KEY_IOS
    : REVENUECAT_API_KEY_ANDROID;
}

async function isRevenueCatConfigured(): Promise<boolean> {
  try {
    return await Purchases.isConfigured();
  } catch {
    return false;
  }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(true);
  const [trialDaysRemaining, setTrialDaysRemaining] =
    useState(TRIAL_DURATION_DAYS);
  const [daysSinceInstall, setDaysSinceInstall] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const listenerRef = useRef<CustomerInfoUpdateListener | null>(null);
  const subscribedRef = useRef(false);
  const lastForegroundRefreshRef = useRef<number | null>(null);

  const checkTrialStatus = useCallback(async () => {
    try {
      let installDate = await AsyncStorage.getItem(STORAGE_KEYS.INSTALL_DATE);

      if (!installDate) {
        const now = new Date().toISOString();
        await AsyncStorage.setItem(STORAGE_KEYS.INSTALL_DATE, now);
        installDate = now;
      }

      const install = new Date(installDate);
      const now = new Date();
      const daysSinceInstall = Math.floor(
        (now.getTime() - install.getTime()) / (1000 * 60 * 60 * 24),
      );
      const remaining = Math.max(0, TRIAL_DURATION_DAYS - daysSinceInstall);

      if (TEST_PAYWALL_MODE) {
        setTrialDaysRemaining(0);
        setIsTrialActive(false);
        return false;
      }

      console.log("[PulseKegel] Trial status:", {
        daysSinceInstall,
        remaining,
        installDate,
      });
      setDaysSinceInstall(daysSinceInstall);
      setTrialDaysRemaining(remaining);
      setIsTrialActive(remaining > 0);

      return remaining > 0;
    } catch (error) {
      console.error("[PulseKegel] Failed to check trial status:", error);
      return true;
    }
  }, []);

  // One place that applies CustomerInfo: named entitlement + safety net
  // (P9b.7), sandbox flag for the purchase context, and the deduped
  // subscription_status_changed log (P9b.5).
  const applierRef = useRef<ReturnType<
    typeof createCustomerInfoApplier
  > | null>(null);
  if (!applierRef.current) {
    applierRef.current = createCustomerInfoApplier({
      setSubscribed: (subscribed) => {
        const was = subscribedRef.current;
        subscribedRef.current = subscribed;
        setIsSubscribed(subscribed);
        // Lost the subscription (expiry/refund): re-read the local challenge
        // state so access doesn't ride on a stale isTrialActive.
        if (was && !subscribed) void checkTrialStatus();
      },
      loadStoredStatus: async () =>
        parseStoredStatus(await AsyncStorage.getItem(LAST_SUB_STATUS_KEY)),
      saveStatus: async (status) => {
        await AsyncStorage.setItem(LAST_SUB_STATUS_KEY, status);
      },
    });
  }
  const applyCustomerInfo = useCallback(
    (info: CustomerInfo) => applierRef.current!.apply(info),
    [],
  );

  // P9b.5: one listener, registered after configure, removed on unmount.
  const registerListener = useCallback(() => {
    if (listenerRef.current) return;
    const listener: CustomerInfoUpdateListener = (info) => {
      applyCustomerInfo(info);
    };
    try {
      Purchases.addCustomerInfoUpdateListener(listener);
      listenerRef.current = listener;
    } catch (error) {
      console.warn("[PulseKegel] CustomerInfo listener failed:", error);
    }
  }, [applyCustomerInfo]);

  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        try {
          Purchases.removeCustomerInfoUpdateListener(listenerRef.current);
        } catch {
          // unmounting anyway
        }
        listenerRef.current = null;
      }
    };
  }, []);

  /** Configure RevenueCat with the platform key; true on success. */
  const configureRevenueCat = useCallback(async (): Promise<boolean> => {
    const apiKey = platformApiKey();
    if (!apiKey) return false;
    try {
      Purchases.configure({ apiKey });
      registerListener();
      return true;
    } catch (error) {
      console.error("[PulseKegel] Failed to configure RevenueCat:", error);
      return false;
    }
  }, [registerListener]);

  const loadOfferings = useCallback(
    (surface: OfferingsSurface) =>
      loadOfferingsWith<PurchasesPackage>(surface, {
        isConfigured: isRevenueCatConfigured,
        configure: configureRevenueCat,
        getOfferings: () => Purchases.getOfferings(),
      }),
    [configureRevenueCat],
  );

  const purchasePackage = useCallback(
    (pkg: PurchasesPackage, source?: PaywallSource): Promise<PurchaseResult> =>
      runPurchase(pkg, source, {
        isConfigured: isRevenueCatConfigured,
        purchasePackage: (p) => Purchases.purchasePackage(p),
        refreshCustomerInfo: async () => {
          await Purchases.invalidateCustomerInfoCache();
          return Purchases.getCustomerInfo();
        },
        applyCustomerInfo: (info) => applyCustomerInfo(info as CustomerInfo),
      }),
    [applyCustomerInfo],
  );

  const restorePurchases = useCallback(
    (): Promise<RestoreOutcome> =>
      runRestore({
        isConfigured: isRevenueCatConfigured,
        configure: configureRevenueCat,
        restorePurchases: () => Purchases.restorePurchases(),
        applyCustomerInfo: (info) => applyCustomerInfo(info as CustomerInfo),
      }),
    [applyCustomerInfo, configureRevenueCat],
  );

  const checkSubscription = useCallback(async () => {
    setIsLoading(true);

    let subscribed = false;
    if (await isRevenueCatConfigured()) {
      try {
        const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
        subscribed = applyCustomerInfo(customerInfo).active;
      } catch (error) {
        console.error("[PulseKegel] Failed to check subscription:", error);
        subscribedRef.current = false;
        setIsSubscribed(false);
      }
    } else {
      subscribedRef.current = false;
      setIsSubscribed(false);
    }

    if (!subscribed) {
      await checkTrialStatus();
    }

    setIsLoading(false);
  }, [applyCustomerInfo, checkTrialStatus]);

  const refreshOnForeground = useCallback(async () => {
    const now = Date.now();
    if (!shouldRefreshOnForeground(lastForegroundRefreshRef.current, now)) {
      return;
    }
    if (!(await isRevenueCatConfigured())) return;
    lastForegroundRefreshRef.current = now;
    try {
      await Purchases.invalidateCustomerInfoCache();
      const info = await Purchases.getCustomerInfo();
      applyCustomerInfo(info);
    } catch (error) {
      console.warn(
        "[PulseKegel] Foreground CustomerInfo refresh failed:",
        error,
      );
    }
  }, [applyCustomerInfo]);

  useEffect(() => {
    const init = async () => {
      try {
        const apiKey = platformApiKey();

        if (!apiKey) {
          await checkTrialStatus();
          setIsLoading(false);
          return;
        }

        if (Platform.OS === "ios" && !apiKey.startsWith("appl_")) {
          console.error(
            `[PulseKegel] WRONG RevenueCat key for iOS — expected appl_ prefix, got ${apiKey.slice(0, 8)}. Check env-config.generated.ts`,
          );
        } else if (Platform.OS === "android" && !apiKey.startsWith("goog_")) {
          console.error(
            `[PulseKegel] WRONG RevenueCat key for Android — expected goog_ prefix, got ${apiKey.slice(0, 8)}. Check env-config.generated.ts`,
          );
        }

        if (!(await configureRevenueCat())) {
          await checkTrialStatus();
          setIsLoading(false);
          return;
        }

        // Identify this device in RevenueCat so trial users appear in the
        // dashboard from first open. Reuse the analytics device ID so events
        // from both systems can be correlated.
        try {
          const analyticsDeviceId = await AsyncStorage.getItem(
            "pulsekegel_analytics_device_id",
          );
          if (analyticsDeviceId) {
            await Purchases.logIn(analyticsDeviceId);
            console.log(
              "[PulseKegel] RevenueCat: identified user",
              analyticsDeviceId.slice(0, 8) + "…",
            );
          }
        } catch (loginError) {
          console.warn(
            "[PulseKegel] RevenueCat logIn failed (non-fatal):",
            loginError,
          );
        }

        let subscribed = false;
        try {
          const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
          subscribed = applyCustomerInfo(customerInfo).active;
        } catch (error) {
          console.error("[PulseKegel] Failed to get customer info:", error);
        }

        if (!subscribed) {
          await checkTrialStatus();

          // Stamp the trial start date as a RevenueCat customer attribute so
          // it surfaces in the RC dashboard alongside the customer record.
          try {
            const installDate = await AsyncStorage.getItem(
              STORAGE_KEYS.INSTALL_DATE,
            );
            if (installDate) {
              await Purchases.setAttributes({
                trialStartDate: installDate,
                isTrialUser: "true",
              });
            }
          } catch {
            // Non-fatal — attributes are best-effort
          }
        }

        // P9b.2: shared loader; failures are logged as offerings_failed
        // (replaces the silent console.error). The paywall loads again.
        const result = await loadOfferings("launch");
        if (result.ok) setPackages(result.packages);

        setIsLoading(false);
      } catch (outerError: any) {
        console.error(
          "[PulseKegel] Critical error in subscription init:",
          outerError,
        );
        await checkTrialStatus().catch(() => {});
        setIsLoading(false);
      }
    };

    init();
  }, [applyCustomerInfo, checkTrialStatus, configureRevenueCat, loadOfferings]);

  const hasAccess = isSubscribed || isTrialActive;

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isTrialActive,
        trialDaysRemaining,
        daysSinceInstall,
        isLoading,
        packages,
        purchasePackage,
        restorePurchases,
        checkSubscription,
        loadOfferings,
        refreshOnForeground,
        hasAccess,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
