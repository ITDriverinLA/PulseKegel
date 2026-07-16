import React, { useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  ANIM_DELAY_SHORT,
  ANIM_DELAY_MED,
  ANIM_DELAY_XL,
} from "@/constants/animation";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { storage } from "@/lib/storage";
import {
  trackPaywallViewed,
  trackPurchaseResult,
  trackSubscribeTapped,
} from "@/lib/analytics";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PaywallRouteProp = RouteProp<RootStackParamList, "Paywall">;

interface ChallengeStats {
  completedCoreSessions: number;
  totalCoreSessions: number;
  completedOptionalSessions: number;
}

function chooseAnnualPackage(pkgs: PurchasesPackage[]): PurchasesPackage | null {
  return (
    pkgs.find(
      (pkg) =>
        String(pkg.packageType).toLowerCase().includes("annual") ||
        pkg.identifier.toLowerCase().includes("annual") ||
        pkg.product.identifier.toLowerCase().includes("annual"),
    ) ??
    pkgs[0] ??
    null
  );
}

interface PaywallScreenProps {
  onClose?: () => void;
}

export default function PaywallScreen({ onClose }: PaywallScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PaywallRouteProp>();
  const source = route.params?.source ?? "unknown";
  const { fontScale } = useAccessibility();
  const {
    packages,
    purchasePackage,
    restorePurchases,
    isLoading,
    trialDaysRemaining,
  } = useSubscription();
  const { cp, isDarkMode } = useThemePreference();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [localPackages, setLocalPackages] = useState(packages);
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(
    null,
  );
  const paywallTrackedRef = useRef(false);

  React.useEffect(() => {
    setLocalPackages(packages);
  }, [packages]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const stats =
        source === "challenge_complete"
          ? await storage.getChallengeStats()
          : null;
      if (cancelled) return;
      setChallengeStats(stats);
      if (!paywallTrackedRef.current) {
        paywallTrackedRef.current = true;
        trackPaywallViewed({
          source,
          trialDaysRemaining,
          completedCoreSessions: stats?.completedCoreSessions,
          totalCoreSessions: stats?.totalCoreSessions,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, trialDaysRemaining]);

  const selectedPackage = chooseAnnualPackage(localPackages);
  const displayedPrice = selectedPackage?.product.priceString ?? "$4.99";
  const isChallengeConversion = source === "challenge_complete";

  const challengeTitle = (() => {
    if (!challengeStats) return "Keep Your Momentum Going";
    if (challengeStats.completedCoreSessions === 0)
      return "Your Training Is Ready";
    if (
      challengeStats.completedCoreSessions >= challengeStats.totalCoreSessions
    )
      return "You Built the Foundation";
    return "Keep Your Momentum Going";
  })();

  const handlePurchase = async () => {
    let pkgs = localPackages;

    if (pkgs.length === 0) {
      setIsPurchasing(true);
      try {
        console.log(
          "[PulseKegel] Paywall: No packages cached, retrying offerings fetch...",
        );
        const offerings = await Purchases.getOfferings();
        if (offerings.current?.availablePackages?.length) {
          pkgs = offerings.current.availablePackages;
          setLocalPackages(pkgs);
          console.log(
            "[PulseKegel] Paywall: Retry succeeded, got",
            pkgs.length,
            "packages",
          );
        } else if (Object.keys(offerings.all).length > 0) {
          const firstOffering = Object.values(offerings.all)[0];
          if (firstOffering?.availablePackages?.length) {
            pkgs = firstOffering.availablePackages;
            setLocalPackages(pkgs);
          }
        }
      } catch (error) {
        console.error("[PulseKegel] Paywall: Retry failed:", error);
      }
      setIsPurchasing(false);
    }

    if (pkgs.length === 0) {
      trackPurchaseResult({ result: "unavailable" });
      Alert.alert(
        "Not Available",
        "Subscriptions are not available right now. Please check your internet connection and try again.",
        [{ text: "OK" }],
      );
      return;
    }

    const pkg = chooseAnnualPackage(pkgs);
    if (!pkg) return;

    trackSubscribeTapped({
      source,
      packageIdentifier: pkg.identifier,
      productIdentifier: pkg.product.identifier,
      displayedPrice: pkg.product.priceString,
    });
    setIsPurchasing(true);
    try {
      const result = await purchasePackage(pkg);
      if (result === "success") {
        onClose?.();
        navigation.goBack();
      } else if (result === "failed" || result === "unavailable") {
        Alert.alert(
          "Purchase Not Completed",
          "We could not complete your subscription. Please check your connection and payment settings, then try again.",
          [{ text: "OK" }],
        );
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
        Alert.alert("Success", "Your purchases have been restored!", [
          { text: "OK" },
        ]);
        onClose?.();
        navigation.goBack();
      } else {
        Alert.alert(
          "No Purchases Found",
          "We could not find any previous purchases to restore.",
          [{ text: "OK" }],
        );
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
    {
      icon: "zap",
      title: "Build Lasting Control",
      desc: "A progressive 12-week training plan",
    },
    {
      icon: "trending-up",
      title: "Keep Making Progress",
      desc: "Guided sessions, ranks, and weekly insights",
    },
    {
      icon: "shield",
      title: "Train Completely Privately",
      desc: "No account and your data stays on your device",
    },
  ];

  return (
    <LinearGradient
      colors={cp.gradient as unknown as [string, string, ...string[]]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={[
            styles.closeButton,
            { top: insets.top + Spacing.sm, backgroundColor: cp.cardBorder },
          ]}
          onPress={handleClose}
          testID="button-close-paywall"
        >
          <Feather name="x" size={24} color={cp.textSecondary} />
        </Pressable>

        <Animated.View
          entering={FadeInDown.delay(ANIM_DELAY_SHORT)}
          style={styles.header}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${cp.neonGreen}26`,
                borderColor: `${cp.neonGreen}4D`,
              },
            ]}
          >
            <Feather
              name={isChallengeConversion ? "award" : "lock"}
              size={32}
              color={cp.neonGreen}
            />
          </View>
          <Text
            style={[styles.title, { fontSize: 28 * fontScale, color: cp.text }]}
          >
            {isChallengeConversion ? challengeTitle : "Unlock Full Access"}
          </Text>
          {isChallengeConversion ? (
            <Text
              style={[
                styles.subtitle,
                { fontSize: 16 * fontScale, color: cp.textSecondary },
              ]}
            >
              {challengeStats
                ? `You completed ${challengeStats.completedCoreSessions} of ${challengeStats.totalCoreSessions} challenge sessions. Continue building control with the full 12-week program.`
                : "Your seven-day challenge is complete. Continue building control with the full 12-week program."}
            </Text>
          ) : trialDaysRemaining > 0 ? (
            <Text
              style={[
                styles.subtitle,
                { fontSize: 16 * fontScale, color: cp.textSecondary },
              ]}
            >
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} left
              in your 7-Day Control Challenge
            </Text>
          ) : (
            <Text
              style={[
                styles.subtitle,
                { fontSize: 16 * fontScale, color: cp.textSecondary },
              ]}
            >
              Your 7-Day Control Challenge has ended
            </Text>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(ANIM_DELAY_MED)}
          style={[
            styles.pricingCard,
            {
              backgroundColor: `${cp.neonGreen}1A`,
              borderColor: `${cp.neonGreen}4D`,
            },
          ]}
        >
          <View style={[styles.priceBadge, { backgroundColor: cp.neonPink }]}>
            <Text style={[styles.priceBadgeText, { color: cp.text }]}>
              FULL 12-WEEK PROGRAM
            </Text>
          </View>
          <Text
            style={[
              styles.price,
              {
                fontSize: 36 * fontScale,
                color: cp.neonGreen,
                textShadowColor: `${cp.neonGreen}80`,
              },
            ]}
          >
            {displayedPrice}
          </Text>
          <Text
            style={[
              styles.priceSubtext,
              { fontSize: 16 * fontScale, color: cp.text },
            ]}
          >
            per year
          </Text>
          <Text
            style={[
              styles.priceNote,
              { fontSize: 12 * fontScale, color: cp.textMuted },
            ]}
          >
            One year of guided, private training
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(ANIM_DELAY_XL)}
          style={styles.ctaSection}
        >
          <Pressable
            style={[
              styles.subscribeButton,
              { backgroundColor: cp.neonGreen, shadowColor: cp.neonGreen },
              (isPurchasing || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={isPurchasing || isLoading}
            testID="button-subscribe"
          >
            {isPurchasing ? (
              <ActivityIndicator color={cp.bg} />
            ) : (
              <>
                <Feather name="unlock" size={20} color={cp.bg} />
                <Text style={[styles.subscribeButtonText, { color: cp.bg }]}>
                  {isChallengeConversion
                    ? `Continue My Training — ${displayedPrice}/year`
                    : `Subscribe — ${displayedPrice}/year`}
                </Text>
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
              <Text
                style={[
                  styles.restoreButtonText,
                  { fontSize: 14 * fontScale, color: cp.neonCyan },
                ]}
              >
                Restore Purchases
              </Text>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(ANIM_DELAY_XL)}
          style={[
            styles.featuresGrid,
            {
              backgroundColor: isDarkMode
                ? "rgba(26, 26, 46, 0.6)"
                : "rgba(255, 255, 255, 0.7)",
              borderColor: `${cp.neonCyan}26`,
            },
          ]}
        >
          {features.map((feature) => (
            <View key={feature.title} style={styles.featureItem}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: `${cp.neonCyan}1A` },
                ]}
              >
                <Feather
                  name={feature.icon as any}
                  size={20}
                  color={cp.neonCyan}
                />
              </View>
              <View style={styles.featureText}>
                <Text
                  style={[
                    styles.featureTitle,
                    { fontSize: 14 * fontScale, color: cp.text },
                  ]}
                >
                  {feature.title}
                </Text>
                <Text
                  style={[
                    styles.featureDesc,
                    { fontSize: 12 * fontScale, color: cp.textSecondary },
                  ]}
                >
                  {feature.desc}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <View style={styles.legalSection}>
          <Text
            style={[
              styles.legalText,
              { fontSize: 11 * fontScale, color: cp.textMuted },
            ]}
          >
            Subscription automatically renews unless auto-renew is turned off at
            least 24-hours before the end of the current period. Your account
            will be charged for renewal within 24-hours prior to the end of the
            current period.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable
              onPress={() => Linking.openURL("https://pulsekegel.com/privacy")}
            >
              <Text style={[styles.legalLink, { color: cp.textMuted }]}>
                Privacy Policy
              </Text>
            </Pressable>
            <Text style={[styles.legalDivider, { color: cp.textMuted }]}>
              |
            </Text>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
                )
              }
            >
              <Text style={[styles.legalLink, { color: cp.textMuted }]}>
                Terms of Use
              </Text>
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
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginTop: Spacing.xl * 2,
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    borderWidth: 2,
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
  },
  featuresGrid: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  featureDesc: {},
  pricingCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
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
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  price: {
    fontWeight: "800",
    textShadowRadius: 20,
  },
  priceSubtext: {
    fontWeight: "500",
    marginTop: Spacing.xs,
  },
  priceNote: {
    marginTop: Spacing.sm,
  },
  ctaSection: {
    marginBottom: Spacing.xl,
  },
  subscribeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "700",
    fontSize: 18,
  },
  restoreButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  restoreButtonText: {
    fontWeight: "500",
  },
  legalSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  legalText: {
    textAlign: "center",
    lineHeight: 16,
    marginBottom: Spacing.md,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  legalLink: {
    fontSize: 12,
    textDecorationLine: "underline",
  },
  legalDivider: {
    fontSize: 12,
  },
});
