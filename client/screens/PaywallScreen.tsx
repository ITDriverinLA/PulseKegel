import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

import Purchases from 'react-native-purchases';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { Spacing, BorderRadius } from '@/constants/theme';

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';
const DARK_GRADIENT = ['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a'] as const;

interface PaywallScreenProps {
  onClose?: () => void;
}

export default function PaywallScreen({ onClose }: PaywallScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fontScale, colors } = useAccessibility();
  const { packages, purchasePackage, restorePurchases, isLoading, trialDaysRemaining, debugInfo } = useSubscription();
  
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [localPackages, setLocalPackages] = useState(packages);

  React.useEffect(() => {
    setLocalPackages(packages);
  }, [packages]);

  const handlePurchase = async () => {
    let pkgs = localPackages;

    if (pkgs.length === 0) {
      setIsPurchasing(true);
      try {
        console.log('[PulseKegel] Paywall: No packages cached, retrying offerings fetch...');
        const offerings = await Purchases.getOfferings();
        if (offerings.current?.availablePackages?.length) {
          pkgs = offerings.current.availablePackages;
          setLocalPackages(pkgs);
          console.log('[PulseKegel] Paywall: Retry succeeded, got', pkgs.length, 'packages');
        } else if (Object.keys(offerings.all).length > 0) {
          const firstOffering = Object.values(offerings.all)[0];
          if (firstOffering?.availablePackages?.length) {
            pkgs = firstOffering.availablePackages;
            setLocalPackages(pkgs);
          }
        }
      } catch (error) {
        console.error('[PulseKegel] Paywall: Retry failed:', error);
      }
      setIsPurchasing(false);
    }

    if (pkgs.length === 0) {
      Alert.alert(
        'Not Available',
        'Subscriptions are not available right now. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchasePackage(pkgs[0]);
      if (success) {
        onClose?.();
        navigation.goBack();
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert('Success', 'Your purchases have been restored!', [{ text: 'OK' }]);
        onClose?.();
        navigation.goBack();
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.', [{ text: 'OK' }]);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigation.goBack();
    }
  };

  const features = [
    { icon: 'zap', title: '12-Week Program', desc: 'Progressive training plan' },
    { icon: 'smartphone', title: 'Haptic Feedback', desc: 'Feel the rhythm' },
    { icon: 'bar-chart-2', title: 'Visual Power Bar', desc: 'Real-time guidance' },
    { icon: 'sun', title: 'Weekly AI Reviews', desc: 'Personalized insights' },
    { icon: 'shield', title: 'Private & Secure', desc: 'Data stays on device' },
    { icon: 'clock', title: 'Quick Sessions', desc: '5-10 minutes daily' },
  ];

  const priceText = packages.length > 0 
    ? `${packages[0].product.priceString} / year`
    : '$4.99 / year';

  return (
    <LinearGradient colors={DARK_GRADIENT} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={[styles.closeButton, { top: insets.top + Spacing.sm }]}
          onPress={handleClose}
          testID="button-close-paywall"
        >
          <Feather name="x" size={24} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name="lock" size={32} color={NEON_GREEN} />
          </View>
          <Text style={[styles.title, { fontSize: 28 * fontScale }]}>
            Unlock Full Access
          </Text>
          {trialDaysRemaining > 0 ? (
            <Text style={[styles.subtitle, { fontSize: 16 * fontScale }]}>
              Your free trial ends in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={[styles.subtitle, { fontSize: 16 * fontScale }]}>
              Your free trial has ended
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <View key={feature.title} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Feather name={feature.icon as any} size={20} color={NEON_CYAN} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { fontSize: 14 * fontScale }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDesc, { fontSize: 12 * fontScale }]}>
                  {feature.desc}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300)} style={styles.pricingCard}>
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>INTRO OFFER</Text>
          </View>
          <Text style={[styles.price, { fontSize: 36 * fontScale }]}>$4.99</Text>
          <Text style={[styles.priceSubtext, { fontSize: 16 * fontScale }]}>
            for 12 months
          </Text>
          <Text style={[styles.priceNote, { fontSize: 12 * fontScale }]}>
            That's just $0.42 per month
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400)} style={styles.ctaSection}>
          <Pressable
            style={[styles.subscribeButton, (isPurchasing || isLoading) && styles.buttonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing || isLoading}
            testID="button-subscribe"
          >
            {isPurchasing ? (
              <ActivityIndicator color="#0a0a1a" />
            ) : (
              <>
                <Feather name="unlock" size={20} color="#0a0a1a" />
                <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isRestoring}
            testID="button-restore"
          >
            {isRestoring ? (
              <ActivityIndicator color={NEON_CYAN} size="small" />
            ) : (
              <Text style={[styles.restoreButtonText, { fontSize: 14 * fontScale }]}>
                Restore Purchases
              </Text>
            )}
          </Pressable>
        </Animated.View>

        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Debug Info (temporary)</Text>
          <Text style={styles.debugText}>Platform: {debugInfo.platform}</Text>
          <Text style={styles.debugText}>API Key Present: {String(debugInfo.apiKeyPresent)}</Text>
          <Text style={styles.debugText}>API Key Length: {debugInfo.apiKeyLength}</Text>
          <Text style={styles.debugText}>RC Configured: {String(debugInfo.configured)}</Text>
          {debugInfo.configError ? <Text style={styles.debugError}>Config Error: {debugInfo.configError}</Text> : null}
          <Text style={styles.debugText}>Offerings: {debugInfo.offeringsResult}</Text>
          {debugInfo.offeringsError ? <Text style={styles.debugError}>Offerings Error: {debugInfo.offeringsError}</Text> : null}
          <Text style={styles.debugText}>Package Count: {debugInfo.packageCount}</Text>
          <Text style={styles.debugText}>Init Complete: {String(debugInfo.initComplete)}</Text>
          <Text style={styles.debugText}>Context Packages: {packages.length}</Text>
        </View>

        <View style={styles.legalSection}>
          <Text style={[styles.legalText, { fontSize: 11 * fontScale }]}>
            Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period. Your account will be charged for renewal within 24-hours prior to the end of the current period.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => Linking.openURL('https://pulsekegel.com/privacy')}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.legalDivider}>|</Text>
            <Pressable onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: Spacing.xl * 2,
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  title: {
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  featuresGrid: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  featureDesc: {
    color: 'rgba(255,255,255,0.6)',
  },
  pricingCard: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  priceBadge: {
    backgroundColor: NEON_PINK,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  priceBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  price: {
    fontWeight: '800',
    color: NEON_GREEN,
    textShadowColor: 'rgba(0, 255, 136, 0.5)',
    textShadowRadius: 20,
  },
  priceSubtext: {
    color: '#fff',
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  priceNote: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.sm,
  },
  ctaSection: {
    marginBottom: Spacing.xl,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: NEON_GREEN,
    paddingVertical: Spacing.md + 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#0a0a1a',
    fontWeight: '700',
    fontSize: 18,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  restoreButtonText: {
    color: NEON_CYAN,
    fontWeight: '500',
  },
  legalSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  legalText: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: Spacing.md,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  debugSection: {
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.4)',
  },
  debugTitle: {
    color: '#FFA500',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  debugText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  debugError: {
    color: '#FF4444',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
});
