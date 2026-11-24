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
  Platform,
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

import Purchases from "react-native-purchases";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { contentInsets, readableColumn } from "@/lib/windowLayout";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { storage } from "@/lib/storage";
import {
  DAY1_SOFT_CTA,
  DAY1_SOFT_DISMISS,
  DAY1_SOFT_HEADLINE,
  buildDay1SoftBody,
  recordPaywallView,
} from "@/lib/day1SoftPaywall";
import {
  trackPaywallViewed,
  trackPaywallDismissed,
  trackPaywallRetryTapped,
  trackPurchaseResult,
  trackSubscribeTapped,
} from "@/lib/analytics";
import {
  ENTITLEMENT_CONFIRMING_NOTE,
  FREE_WEEK_CTA,
  PAYMENT_PENDING_NOTE,
  PAYWALL_LOADING_PRICE,
  RESTORE_UNREACHABLE_BODY,
  RESTORE_UNREACHABLE_TITLE,
  continueTrainingCta,
  freeWeekPriceLine,
  subscribeCta,
} from "@/constants/paywallCopy";
import { getPurchaseContext } from "@/lib/purchaseContext";
import {
  chooseAnnualPackage,
  packageIds,
  storePriceString,
} from "@/lib/purchaseFlow";
import {
  derivePaywallView,
  freeWeekEligible,
  iosHasFreeWeekIntro,
  shouldLoadOnMount,
  unavailableCopyFor,
  type PaywallFailure,
} from "@/lib/paywallState";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PaywallRouteProp = RouteProp<RootStackParamList, "Paywall">;

interface ChallengeStats {
  completedCoreSessions: number;
  totalCoreSessions: number;
  completedOptionalSessions: number;
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
    isTrialActive,
    isSubscribed,
    loadOfferings,
  } = useSubscription();
  const { cp, isDarkMode } = useThemePreference();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [localPackages, setLocalPackages] = useState(packages);
  // P9b.1: why there's nothing to buy (code 3 → billing-not-allowed copy).
  const [failure, setFailure] = useState<PaywallFailure | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  // P9b.1 / P9b.4: inline notes instead of a failure alert.
  const [purchaseNote, setPurchaseNote] = useState<string | null>(null);
  const [iosIntroStatus, setIosIntroStatus] = useState<number | null>(null);
  const closedRef = useRef(false);
  const subscribedAtMountRef = useRef(isSubscribed);
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(
    null,
  );
  const paywallTrackedRef = useRef(false);

  React.useEffect(() => {
    setLocalPackages(packages);
    if (packages.length > 0) setFailure(null);
  }, [packages]);

  const mountedRef = useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // P9b.3: nothing cached and the launch load is done → load once here so the
  // paywall shows loading, then the real price or the unavailable state.
  const mountLoadDoneRef = useRef(false);
  React.useEffect(() => {
    if (mountLoadDoneRef.current) return;
    if (localPackages.length > 0) {
      mountLoadDoneRef.current = true;
      return;
    }
    if (
      !shouldLoadOnMount({
        hasPackages: false,
        contextLoading: isLoading,
        alreadyLoading: false,
      })
    ) {
      return;
    }
    mountLoadDoneRef.current = true;
    (async () => {
      const result = await loadOfferings("paywall_retry");
      if (!mountedRef.current) return;
      if (result.ok) {
        setLocalPackages(result.packages);
        setFailure(null);
      } else {
        setFailure({ rcCode: result.rcCode, code: result.errorCode });
      }
    })();
  }, [isLoading, loadOfferings, localPackages.length]);

  // P9b.5: a late purchase (pending / Ask to Buy / another device) unlocks
  // through the listener; close the paywall if it's still open.
  React.useEffect(() => {
    if (isSubscribed && !subscribedAtMountRef.current && !closedRef.current) {
      closedRef.current = true;
      onClose?.();
      navigation.goBack();
    }
  }, [isSubscribed, navigation, onClose]);

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
        const purchaseCtx = await getPurchaseContext();
        await recordPaywallView(
          {
            source,
            trialDaysRemaining,
            completedCoreSessions: stats?.completedCoreSessions,
            totalCoreSessions: stats?.totalCoreSessions,
          },
          {
            // P9a.6: store + buildEnv so the funnel's first step filters too.
            trackPaywallViewed: (data) =>
              trackPaywallViewed({
                ...data,
                store: purchaseCtx.store,
                buildEnv: purchaseCtx.buildEnv,
              }),
            markDay1SoftPaywallShown: () => storage.markDay1SoftPaywallShown(),
          },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, trialDaysRemaining]);

  const selectedPackage = chooseAnnualPackage(localPackages);
  // P9b.3: only ever the store's price string; no fallback price.
  const storePrice = storePriceString(selectedPackage);
  const view = derivePaywallView({
    hasPackages: Boolean(selectedPackage && storePrice),
    failure,
  });
  const isChallengeConversion = source === "challenge_complete";
  const isDay1Soft = source === "day1_soft";

  // P9b.6: iOS free-week eligibility for this user.
  const selectedProductId = selectedPackage?.product.identifier;
  const selectedHasIosIntro =
    Platform.OS === "ios" && iosHasFreeWeekIntro(selectedPackage?.product);
  React.useEffect(() => {
    if (!selectedHasIosIntro || !selectedProductId) {
      setIosIntroStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(
          [selectedProductId],
        );
        if (!cancelled) {
          setIosIntroStatus(result[selectedProductId]?.status ?? null);
        }
      } catch {
        if (!cancelled) setIosIntroStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedHasIosIntro, selectedProductId]);
  const showFreeWeek =
    view.kind === "priced" &&
    freeWeekEligible({
      os: Platform.OS,
      product: selectedPackage?.product,
      iosEligibilityStatus: iosIntroStatus,
    });

  const unavailableCopy = unavailableCopyFor(
    view.kind === "unavailable" ? view.variant : "generic",
    Platform.OS,
  );

  const ctaLabel = (() => {
    if (isDay1Soft) return DAY1_SOFT_CTA;
    if (showFreeWeek) return FREE_WEEK_CTA;
    if (!storePrice) return "";
    return isChallengeConversion
      ? continueTrainingCta(storePrice)
      : subscribeCta(storePrice);
  })();

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

  const closePaywall = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose?.();
    navigation.goBack();
  };

  const handlePurchase = async () => {
    let pkgs = localPackages;
    let pkg = chooseAnnualPackage(pkgs);
    const shownPrice = view.kind === "priced" ? storePrice : undefined;
    // P9a.3 / A1: log the tap first, including taps that end unavailable.
    trackSubscribeTapped({
      source,
      ...(pkg
        ? {
            packageIdentifier: packageIds(pkg).packageIdentifier,
            productIdentifier: packageIds(pkg).productIdentifier,
          }
        : {}),
      ...(shownPrice ? { displayedPrice: shownPrice } : {}),
      hasPackages: pkgs.length > 0,
    });
    setPurchaseNote(null);

    if (!pkg) {
      setIsPurchasing(true);
      const result = await loadOfferings("paywall_retry");
      setIsPurchasing(false);
      if (!result.ok) {
        const ctx = await getPurchaseContext();
        trackPurchaseResult({
          result: "unavailable",
          source,
          errorCode: result.errorCode,
          store: ctx.store,
          buildEnv: ctx.buildEnv,
          ...(ctx.isSandbox !== undefined ? { isSandbox: ctx.isSandbox } : {}),
          ...(result.rcCode !== undefined ? { rcCode: result.rcCode } : {}),
          ...(result.readableErrorCode
            ? { readableErrorCode: result.readableErrorCode }
            : {}),
          ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
        });
        // P9b.1: inline unavailable state instead of an alert.
        setFailure({ rcCode: result.rcCode, code: result.errorCode });
        return;
      }
      pkgs = result.packages;
      setLocalPackages(pkgs);
      setFailure(null);
      pkg = chooseAnnualPackage(pkgs);
      if (!pkg) return;
    }

    setIsPurchasing(true);
    try {
      const result = await purchasePackage(pkg, source);
      if (result === "success") {
        closePaywall();
      } else if (result === "not_allowed") {
        // P9b.1: code 3 on purchase → billing-not-allowed state, no price.
        setLocalPackages([]);
        setFailure({ rcCode: 3, code: "rc_3" });
      } else if (result === "pending") {
        setPurchaseNote(PAYMENT_PENDING_NOTE);
      } else if (result === "confirming") {
        setPurchaseNote(ENTITLEMENT_CONFIRMING_NOTE);
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

  // P9b.1: Retry re-runs the offerings fetch. One fetch per tap, no loop.
  const handleRetry = async () => {
    if (isRetrying || view.kind !== "unavailable") return;
    trackPaywallRetryTapped({ code: view.code });
    setIsRetrying(true);
    try {
      const result = await loadOfferings("paywall_retry");
      if (!mountedRef.current) return;
      if (result.ok) {
        setLocalPackages(result.packages);
        setFailure(null);
      } else {
        setFailure({ rcCode: result.rcCode, code: result.errorCode });
      }
    } finally {
      if (mountedRef.current) setIsRetrying(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const outcome = await restorePurchases();
      if (outcome === "restored") {
        Alert.alert("Success", "Your purchases have been restored!", [
          { text: "OK" },
        ]);
        closePaywall();
      } else if (outcome === "error") {
        // P9b.8: the store call failed; don't claim nothing was found.
        Alert.alert(RESTORE_UNREACHABLE_TITLE, RESTORE_UNREACHABLE_BODY, [
          { text: "OK" },
        ]);
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

  const handleClose = (method: "not_now" | "close" = "close") => {
    trackPaywallDismissed({ source, method });
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
      desc: "No account, and your data stays on your device by default.",
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
          contentInsets(insets, {
            top: Spacing.lg,
            bottom: Spacing.xl,
            horizontal: Spacing.lg,
          }),
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={[
            styles.closeButton,
            {
              top: insets.top + Spacing.sm,
              right: insets.right + Spacing.lg,
              backgroundColor: cp.cardBorder,
            },
          ]}
          onPress={() => handleClose("close")}
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
            {isDay1Soft
              ? DAY1_SOFT_HEADLINE
              : isChallengeConversion
                ? challengeTitle
                : "Unlock Full Access"}
          </Text>
          {isDay1Soft ? (
            <Text
              style={[
                styles.subtitle,
                { fontSize: 16 * fontScale, color: cp.textSecondary },
              ]}
              testID="text-day1-soft-body"
            >
              {buildDay1SoftBody(trialDaysRemaining, isTrialActive)}
            </Text>
          ) : isChallengeConversion ? (
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
          {view.kind === "priced" ? (
            <>
              <Text
                style={[
                  styles.price,
                  {
                    fontSize: 36 * fontScale,
                    color: cp.neonGreen,
                    textShadowColor: `${cp.neonGreen}80`,
                  },
                ]}
                testID="text-store-price"
              >
                {storePrice}
              </Text>
              <Text
                style={[
                  styles.priceSubtext,
                  { fontSize: 16 * fontScale, color: cp.text },
                ]}
              >
                per year
              </Text>
              {showFreeWeek && storePrice ? (
                <Text
                  style={[
                    styles.priceNote,
                    { fontSize: 13 * fontScale, color: cp.text },
                  ]}
                  testID="text-free-week"
                >
                  {freeWeekPriceLine(storePrice)}
                </Text>
              ) : null}
            </>
          ) : view.kind === "loading" ? (
            <View style={styles.priceLoading} testID="text-price-loading">
              <ActivityIndicator color={cp.neonGreen} size="small" />
              <Text
                style={[
                  styles.priceSubtext,
                  { fontSize: 16 * fontScale, color: cp.textSecondary },
                ]}
              >
                {PAYWALL_LOADING_PRICE}
              </Text>
            </View>
          ) : (
            <View
              style={styles.unavailableState}
              testID={`paywall-unavailable-${view.variant}`}
            >
              <Text
                style={[
                  styles.unavailableTitle,
                  { fontSize: 18 * fontScale, color: cp.text },
                ]}
              >
                {unavailableCopy.title}
              </Text>
              <Text
                style={[
                  styles.unavailableBody,
                  { fontSize: 14 * fontScale, color: cp.textSecondary },
                ]}
              >
                {unavailableCopy.body}
              </Text>
            </View>
          )}
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
          {view.kind === "unavailable" ? (
            <>
              <Pressable
                style={[
                  styles.subscribeButton,
                  { backgroundColor: cp.neonGreen, shadowColor: cp.neonGreen },
                  isRetrying && styles.buttonDisabled,
                ]}
                onPress={handleRetry}
                disabled={isRetrying}
                testID="button-paywall-retry"
              >
                {isRetrying ? (
                  <ActivityIndicator color={cp.bg} />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={20} color={cp.bg} />
                    <Text
                      style={[styles.subscribeButtonText, { color: cp.bg }]}
                    >
                      {unavailableCopy.retry}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.restoreButton}
                onPress={() => handleClose("not_now")}
                testID="button-paywall-not-now"
              >
                <Text
                  style={[
                    styles.restoreButtonText,
                    { fontSize: 15 * fontScale, color: cp.textSecondary },
                  ]}
                >
                  {unavailableCopy.dismiss}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[
                  styles.subscribeButton,
                  { backgroundColor: cp.neonGreen, shadowColor: cp.neonGreen },
                  (isPurchasing || view.kind === "loading") &&
                    styles.buttonDisabled,
                ]}
                onPress={handlePurchase}
                disabled={isPurchasing || view.kind === "loading"}
                testID="button-subscribe"
              >
                {isPurchasing || view.kind === "loading" ? (
                  <ActivityIndicator color={cp.bg} />
                ) : (
                  <>
                    <Feather name="unlock" size={20} color={cp.bg} />
                    <Text
                      style={[styles.subscribeButtonText, { color: cp.bg }]}
                    >
                      {ctaLabel}
                    </Text>
                  </>
                )}
              </Pressable>

              {purchaseNote ? (
                <Text
                  style={[
                    styles.purchaseNote,
                    { fontSize: 14 * fontScale, color: cp.textSecondary },
                  ]}
                  testID="text-purchase-note"
                >
                  {purchaseNote}
                </Text>
              ) : null}

              {isDay1Soft ? (
                <Pressable
                  style={styles.restoreButton}
                  onPress={() => handleClose("not_now")}
                  testID="button-day1-soft-not-now"
                >
                  <Text
                    style={[
                      styles.restoreButtonText,
                      { fontSize: 15 * fontScale, color: cp.textSecondary },
                    ]}
                  >
                    {DAY1_SOFT_DISMISS}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}

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
    ...readableColumn,
  },
  closeButton: {
    position: "absolute",
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
  priceLoading: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  unavailableState: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  unavailableTitle: {
    fontWeight: "700",
    textAlign: "center",
  },
  unavailableBody: {
    textAlign: "center",
    lineHeight: 20,
  },
  purchaseNote: {
    textAlign: "center",
    marginTop: Spacing.md,
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
