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
import { useThemePreference } from '@/contexts/ThemePreferenceContext';

interface PaywallScreenProps {
  onClose?: () => void;
}

export default function PaywallScreen({ onClose }: PaywallScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fontScale, colors } = useAccessibility();
  const { packages, purchasePackage, restorePurchases, isLoading, trialDaysRemaining } = useSubscription();
  const { cp, isDarkMode } = useThemePreference();
  
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
    <LinearGradient colors={cp.gradient as unknown as [string, string, ...string[]]} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={[styles.closeButton, { top: insets.top + Spacing.sm, backgroundColor: cp.cardBorder }]}
          onPress={handleClose}
          testID="button-close-paywall"
        >
          <Feather name="x" size={24} color={cp.textSecondary} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${cp.neonGreen}26`, borderColor: `${cp.neonGreen}4D` }]}>
            <Feather name="lock" size={32} color={cp.neonGreen} />
          </View>
          <Text style={[styles.title, { fontSize: 28 * fontScale, color: cp.text }]}>
            Unlock Full Access
          </Text>
          {trialDaysRemaining > 0 ? (
            <Text style={[styles.subtitle, { fontSize: 16 * fontScale, color: cp.textSecondary }]}>
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in your 7-Day Control Challenge
            </Text>
          ) : (
            <Text style={[styles.subtitle, { fontSize: 16 * fontScale, color: cp.textSecondary }]}>
              Your 7-Day Control Challenge has ended
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={[styles.featuresGrid, { backgroundColor: isDarkMode ? 'rgba(26, 26, 46, 0.6)' : 'rgba(255, 255, 255, 0.7)', borderColor: `${cp.neonCyan}26` }]}>
          {features.map((feature, index) => (
            <View key={feature.title} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: `${cp.neonCyan}1A` }]}>
                <Feather name={feature.icon as any} size={20} color={cp.neonCyan} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { fontSize: 14 * fontScale, color: cp.text }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDesc, { fontSize: 12 * fontScale, color: cp.textSecondary }]}>
                  {feature.desc}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300)} style={[styles.pricingCard, { backgroundColor: `${cp.neonGreen}1A`, borderColor: `${cp.neonGreen}4D` }]}>
          <View style={[styles.priceBadge, { backgroundColor: cp.neonPink }]}>
            <Text style={[styles.priceBadgeText, { color: cp.text }]}>INTRO OFFER</Text>
          </View>
          <Text style={[styles.price, { fontSize: 36 * fontScale, color: cp.neonGreen, textShadowColor: `${cp.neonGreen}80` }]}>$4.99</Text>
          <Text style={[styles.priceSubtext, { fontSize: 16 * fontScale, color: cp.text }]}>
            for 12 months
          </Text>
          <Text style={[styles.priceNote, { fontSize: 12 * fontScale, color: cp.textMuted }]}>
            That's just $0.42 per month
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400)} style={styles.ctaSection}>
          <Pressable
            style={[styles.subscribeButton, { backgroundColor: cp.neonGreen, shadowColor: cp.neonGreen }, (isPurchasing || isLoading) && styles.buttonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing || isLoading}
            testID="button-subscribe"
          >
            {isPurchasing ? (
              <ActivityIndicator color={cp.bg} />
            ) : (
              <>
                <Feather name="unlock" size={20} color={cp.bg} />
                <Text style={[styles.subscribeButtonText, { color: cp.bg }]}>Subscribe Now</Text>
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
              <ActivityIndicator color={cp.neonCyan} size="small" />
            ) : (
              <Text style={[styles.restoreButtonText, { fontSize: 14 * fontScale, color: cp.neonCyan }]}>
                Restore Purchases
              </Text>
            )}
          </Pressable>
        </Animated.View>

        <View style={styles.legalSection}>
          <Text style={[styles.legalText, { fontSize: 11 * fontScale, color: cp.textMuted }]}>
            Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period. Your account will be charged for renewal within 24-hours prior to the end of the current period.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => Linking.openURL('https://pulsekegel.com/privacy')}>
              <Text style={[styles.legalLink, { color: cp.textMuted }]}>Privacy Policy</Text>
            </Pressable>
            <Text style={[styles.legalDivider, { color: cp.textMuted }]}>|</Text>
            <Pressable onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              <Text style={[styles.legalLink, { color: cp.textMuted }]}>Terms of Use</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
  },
  featuresGrid: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDesc: {
  },
  pricingCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
  },
  priceBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  priceBadgeText: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  price: {
    fontWeight: '800',
    textShadowRadius: 20,
  },
  priceSubtext: {
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  priceNote: {
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
    paddingVertical: Spacing.md + 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    fontWeight: '700',
    fontSize: 18,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  restoreButtonText: {
    fontWeight: '500',
  },
  legalSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  legalText: {
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
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    fontSize: 12,
  },
});
