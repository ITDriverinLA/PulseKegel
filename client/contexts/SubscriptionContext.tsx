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
  PurchasesPackage,
} from "react-native-purchases";

import { GENERATED_ENV } from "@/lib/env-config.generated";

const STORAGE_KEYS = {
  INSTALL_DATE: "pulsekegel_install_date",
  SUBSCRIPTION_STATUS: "pulsekegel_subscription_status",
};

const TRIAL_DURATION_DAYS = 7;

const TEST_PAYWALL_MODE = false;

interface SubscriptionContextType {
  isSubscribed: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  daysSinceInstall: number;
  isLoading: boolean;
  packages: PurchasesPackage[];
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscription: () => Promise<void>;
  hasAccess: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: false,
  isTrialActive: true,
  trialDaysRemaining: TRIAL_DURATION_DAYS,
  daysSinceInstall: 0,
  isLoading: true,
  packages: [],
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  checkSubscription: async () => {},
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

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(true);
  const [trialDaysRemaining, setTrialDaysRemaining] =
    useState(TRIAL_DURATION_DAYS);
  const [daysSinceInstall, setDaysSinceInstall] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const configuredRef = useRef(false);

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

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      if (!configuredRef.current) {
        console.log(
          "[PulseKegel] Purchase attempted but RevenueCat not configured",
        );
        return false;
      }

      try {
        console.log(
          "[PulseKegel] Attempting purchase for package:",
          pkg.identifier,
        );
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const hasActiveEntitlement =
          Object.keys(customerInfo.entitlements.active).length > 0;
        console.log(
          "[PulseKegel] Purchase result - active entitlements:",
          Object.keys(customerInfo.entitlements.active),
        );
        setIsSubscribed(hasActiveEntitlement);
        return hasActiveEntitlement;
      } catch (error: any) {
        if (!error.userCancelled) {
          console.error(
            "[PulseKegel] Purchase failed:",
            error.message || error,
          );
        } else {
          console.log("[PulseKegel] Purchase cancelled by user");
        }
        return false;
      }
    },
    [],
  );

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!configuredRef.current) {
      console.log(
        "[PulseKegel] Restore attempted but RevenueCat not configured",
      );
      return false;
    }

    try {
      console.log("[PulseKegel] Restoring purchases...");
      const customerInfo = await Purchases.restorePurchases();
      const hasActiveEntitlement =
        Object.keys(customerInfo.entitlements.active).length > 0;
      console.log(
        "[PulseKegel] Restore result - active entitlements:",
        Object.keys(customerInfo.entitlements.active),
      );
      setIsSubscribed(hasActiveEntitlement);
      return hasActiveEntitlement;
    } catch (error) {
      console.error("[PulseKegel] Restore failed:", error);
      return false;
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    setIsLoading(true);

    let subscribed = false;
    if (configuredRef.current) {
      try {
        const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
        subscribed = Object.keys(customerInfo.entitlements.active).length > 0;
        console.log(
          "[PulseKegel] Subscription check - active entitlements:",
          Object.keys(customerInfo.entitlements.active),
        );
      } catch (error) {
        console.error("[PulseKegel] Failed to check subscription:", error);
      }
    }

    setIsSubscribed(subscribed);

    if (!subscribed) {
      await checkTrialStatus();
    }

    setIsLoading(false);
  }, [checkTrialStatus]);

  useEffect(() => {
    const init = async () => {
      try {
        const apiKey =
          Platform.OS === "ios"
            ? REVENUECAT_API_KEY_IOS
            : REVENUECAT_API_KEY_ANDROID;

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

        try {
          await Purchases.configure({ apiKey });
          configuredRef.current = true;
        } catch (error: any) {
          console.error("[PulseKegel] Failed to configure RevenueCat:", error);
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
          subscribed = Object.keys(customerInfo.entitlements.active).length > 0;
          setIsSubscribed(subscribed);
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

        try {
          const offerings = await Purchases.getOfferings();

          if (offerings.current?.availablePackages) {
            setPackages(offerings.current.availablePackages);
          } else {
            const allKeys = Object.keys(offerings.all);
            if (allKeys.length > 0) {
              const firstOffering = Object.values(offerings.all)[0];
              if (firstOffering?.availablePackages?.length > 0) {
                setPackages(firstOffering.availablePackages);
              }
            }
          }
        } catch (error: any) {
          console.error("[PulseKegel] Failed to load offerings:", error);
        }

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
  }, [checkTrialStatus]);

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
