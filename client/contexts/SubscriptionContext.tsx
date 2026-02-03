import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

const STORAGE_KEYS = {
  INSTALL_DATE: 'pulsekegel_install_date',
  SUBSCRIPTION_STATUS: 'pulsekegel_subscription_status',
};

const TRIAL_DURATION_DAYS = 7;

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
}

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
});

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(true);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(TRIAL_DURATION_DAYS);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isRevenueCatConfigured, setIsRevenueCatConfigured] = useState(false);

  const initializeRevenueCat = useCallback(async () => {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    
    if (!apiKey) {
      console.log('RevenueCat API key not configured, running in trial-only mode');
      return false;
    }

    try {
      await Purchases.configure({ apiKey });
      setIsRevenueCatConfigured(true);
      return true;
    } catch (error) {
      console.error('Failed to configure RevenueCat:', error);
      return false;
    }
  }, []);

  const loadPackages = useCallback(async () => {
    if (!isRevenueCatConfigured) return;
    
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
  }, [isRevenueCatConfigured]);

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
      
      setTrialDaysRemaining(remaining);
      setIsTrialActive(remaining > 0);
      
      return remaining > 0;
    } catch (error) {
      console.error('Failed to check trial status:', error);
      return true;
    }
  }, []);

  const checkRevenueCatSubscription = useCallback(async (): Promise<boolean> => {
    if (!isRevenueCatConfigured) return false;
    
    try {
      const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      return hasActiveEntitlement;
    } catch (error) {
      console.error('Failed to check subscription:', error);
      return false;
    }
  }, [isRevenueCatConfigured]);

  const checkSubscription = useCallback(async () => {
    setIsLoading(true);
    
    const subscribed = await checkRevenueCatSubscription();
    setIsSubscribed(subscribed);
    
    if (!subscribed) {
      await checkTrialStatus();
    }
    
    setIsLoading(false);
  }, [checkRevenueCatSubscription, checkTrialStatus]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!isRevenueCatConfigured) {
      console.log('RevenueCat not configured');
      return false;
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      setIsSubscribed(hasActiveEntitlement);
      return hasActiveEntitlement;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('Purchase failed:', error);
      }
      return false;
    }
  }, [isRevenueCatConfigured]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!isRevenueCatConfigured) {
      console.log('RevenueCat not configured');
      return false;
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      setIsSubscribed(hasActiveEntitlement);
      return hasActiveEntitlement;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    }
  }, [isRevenueCatConfigured]);

  useEffect(() => {
    const init = async () => {
      await initializeRevenueCat();
      await checkTrialStatus();
      await checkSubscription();
      await loadPackages();
    };
    
    init();
  }, []);

  useEffect(() => {
    if (isRevenueCatConfigured) {
      loadPackages();
    }
  }, [isRevenueCatConfigured, loadPackages]);

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
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
