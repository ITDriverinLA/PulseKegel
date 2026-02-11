import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

const STORAGE_KEYS = {
  INSTALL_DATE: 'pulsekegel_install_date',
  SUBSCRIPTION_STATUS: 'pulsekegel_subscription_status',
};

const TRIAL_DURATION_DAYS = 7;

const TEST_PAYWALL_MODE = false;

interface DebugInfo {
  platform: string;
  apiKeyPresent: boolean;
  apiKeyLength: number;
  configured: boolean;
  configError: string | null;
  offeringsResult: string;
  offeringsError: string | null;
  packageCount: number;
  initComplete: boolean;
}

interface SubscriptionContextType {
  isSubscribed: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  isLoading: boolean;
  packages: PurchasesPackage[];
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscription: () => Promise<void>;
  hasAccess: boolean;
  debugInfo: DebugInfo;
}

const defaultDebugInfo: DebugInfo = {
  platform: '',
  apiKeyPresent: false,
  apiKeyLength: 0,
  configured: false,
  configError: null,
  offeringsResult: 'pending',
  offeringsError: null,
  packageCount: 0,
  initComplete: false,
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: false,
  isTrialActive: true,
  trialDaysRemaining: TRIAL_DURATION_DAYS,
  isLoading: true,
  packages: [],
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  checkSubscription: async () => {},
  hasAccess: true,
  debugInfo: defaultDebugInfo,
});

import { GENERATED_ENV } from '@/lib/env-config.generated';

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || GENERATED_ENV.REVENUECAT_IOS_KEY || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || GENERATED_ENV.REVENUECAT_ANDROID_KEY || '';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(true);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(TRIAL_DURATION_DAYS);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>(defaultDebugInfo);
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
      const daysSinceInstall = Math.floor((now.getTime() - install.getTime()) / (1000 * 60 * 60 * 24));
      const remaining = Math.max(0, TRIAL_DURATION_DAYS - daysSinceInstall);
      
      if (TEST_PAYWALL_MODE) {
        setTrialDaysRemaining(0);
        setIsTrialActive(false);
        return false;
      }
      
      console.log('[PulseKegel] Trial status:', { daysSinceInstall, remaining, installDate });
      setTrialDaysRemaining(remaining);
      setIsTrialActive(remaining > 0);
      
      return remaining > 0;
    } catch (error) {
      console.error('[PulseKegel] Failed to check trial status:', error);
      return true;
    }
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!configuredRef.current) {
      console.log('[PulseKegel] Purchase attempted but RevenueCat not configured');
      return false;
    }

    try {
      console.log('[PulseKegel] Attempting purchase for package:', pkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      console.log('[PulseKegel] Purchase result - active entitlements:', Object.keys(customerInfo.entitlements.active));
      setIsSubscribed(hasActiveEntitlement);
      return hasActiveEntitlement;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('[PulseKegel] Purchase failed:', error.message || error);
      } else {
        console.log('[PulseKegel] Purchase cancelled by user');
      }
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!configuredRef.current) {
      console.log('[PulseKegel] Restore attempted but RevenueCat not configured');
      return false;
    }

    try {
      console.log('[PulseKegel] Restoring purchases...');
      const customerInfo = await Purchases.restorePurchases();
      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      console.log('[PulseKegel] Restore result - active entitlements:', Object.keys(customerInfo.entitlements.active));
      setIsSubscribed(hasActiveEntitlement);
      return hasActiveEntitlement;
    } catch (error) {
      console.error('[PulseKegel] Restore failed:', error);
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
        console.log('[PulseKegel] Subscription check - active entitlements:', Object.keys(customerInfo.entitlements.active));
      } catch (error) {
        console.error('[PulseKegel] Failed to check subscription:', error);
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
      console.log('[PulseKegel] === Subscription Init Starting ===');
      console.log('[PulseKegel] Platform:', Platform.OS);

      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
      console.log('[PulseKegel] API key present:', !!apiKey, '| Key length:', apiKey.length);

      const debug: DebugInfo = {
        platform: Platform.OS,
        apiKeyPresent: !!apiKey,
        apiKeyLength: apiKey.length,
        configured: false,
        configError: null,
        offeringsResult: 'not started',
        offeringsError: null,
        packageCount: 0,
        initComplete: false,
      };

      if (!apiKey) {
        console.log('[PulseKegel] No API key - running in trial-only mode');
        debug.offeringsResult = 'skipped (no key)';
        debug.initComplete = true;
        setDebugInfo(debug);
        await checkTrialStatus();
        setIsLoading(false);
        return;
      }

      try {
        console.log('[PulseKegel] Configuring RevenueCat...');
        await Purchases.configure({ apiKey });
        configuredRef.current = true;
        debug.configured = true;
        console.log('[PulseKegel] RevenueCat configured successfully');
      } catch (error: any) {
        console.error('[PulseKegel] Failed to configure RevenueCat:', error);
        debug.configError = error?.message || String(error);
        debug.initComplete = true;
        setDebugInfo(debug);
        await checkTrialStatus();
        setIsLoading(false);
        return;
      }

      let subscribed = false;
      try {
        console.log('[PulseKegel] Checking customer info...');
        const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
        subscribed = Object.keys(customerInfo.entitlements.active).length > 0;
        console.log('[PulseKegel] Active entitlements:', Object.keys(customerInfo.entitlements.active));
        console.log('[PulseKegel] All entitlements:', Object.keys(customerInfo.entitlements.all));
        setIsSubscribed(subscribed);
      } catch (error) {
        console.error('[PulseKegel] Failed to get customer info:', error);
      }

      if (!subscribed) {
        await checkTrialStatus();
      }

      try {
        console.log('[PulseKegel] Loading offerings...');
        const offerings = await Purchases.getOfferings();
        const currentId = offerings.current?.identifier || 'NONE';
        const allKeys = Object.keys(offerings.all);
        const pkgCount = offerings.current?.availablePackages?.length || 0;

        debug.offeringsResult = `current=${currentId}, all=[${allKeys.join(',')}], pkgs=${pkgCount}`;

        console.log('[PulseKegel] Offerings response:', {
          currentOffering: currentId,
          allOfferingKeys: allKeys,
          availablePackages: pkgCount,
        });

        if (offerings.current?.availablePackages) {
          const pkgs = offerings.current.availablePackages;
          debug.packageCount = pkgs.length;
          console.log('[PulseKegel] Packages loaded:', pkgs.map(p => ({
            id: p.identifier,
            productId: p.product.identifier,
            price: p.product.priceString,
          })));
          setPackages(pkgs);
        } else {
          console.warn('[PulseKegel] No current offering or no packages available');
          if (allKeys.length > 0) {
            console.log('[PulseKegel] Available offerings (not current):', allKeys);
            const firstOffering = Object.values(offerings.all)[0];
            if (firstOffering?.availablePackages?.length > 0) {
              console.log('[PulseKegel] Using first available offering:', firstOffering.identifier);
              debug.packageCount = firstOffering.availablePackages.length;
              setPackages(firstOffering.availablePackages);
            }
          }
        }
      } catch (error: any) {
        console.error('[PulseKegel] Failed to load offerings:', error);
        debug.offeringsError = error?.message || String(error);
      }

      debug.initComplete = true;
      setDebugInfo(debug);
      setIsLoading(false);
      console.log('[PulseKegel] === Subscription Init Complete ===');
    };

    init();
  }, []);

  const hasAccess = isSubscribed || isTrialActive;

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isTrialActive,
        trialDaysRemaining,
        isLoading,
        packages,
        purchasePackage,
        restorePurchases,
        checkSubscription,
        hasAccess,
        debugInfo,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
