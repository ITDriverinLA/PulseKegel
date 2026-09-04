import React, { useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Image,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  Animated as RNAnimated,
  AppState,
  AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import {
  ANIM_DURATION_MICRO,
  ANIM_DURATION_RESET_FAST,
} from "@/constants/animation";
import { Feather } from "@expo/vector-icons";

import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, AnatomyType } from "@/lib/storage";
import { didAppBecomeActive } from "@/lib/appState";
import {
  trackOnboardingAbandoned,
  trackOnboardingAnatomySelected,
  trackOnboardingComplete,
  trackOnboardingCtaTapped,
  trackOnboardingScreenViewed,
} from "@/lib/analytics";

interface OnboardingScreenProps {
  onComplete: () => void;
}

const { width, height } = Dimensions.get("window");

const HERO_COMBINED = require("../assets/images/onboarding/hero-combined.jpg");
const MAN_HERO = require("../assets/images/onboarding/male-hero.jpg");
const WOMAN_HERO = require("../assets/images/onboarding/female-hero.jpg");

const BLUE = "#00AAFF";
const BLUE_DIM = "rgba(0,170,255,0.15)";
const BLUE_BORDER = "rgba(0,170,255,0.4)";
const PINK = "#FF2D78";
const PINK_DIM = "rgba(255,45,120,0.15)";
const PINK_BORDER = "rgba(255,45,120,0.4)";
const TEXT = "#F0F2FF";
const TEXT_SEC = "rgba(240,242,255,0.65)";
const TEXT_MUTED = "rgba(240,242,255,0.38)";
const BG_GRADIENT: [string, string, string, string] = [
  "#07081A",
  "#0A0B22",
  "#0D0E28",
  "#070818",
];

/** Epic B: ≤3 onboarding screens before first-session gate. */
export const ONBOARDING_SCREEN_KEYS = ["welcome", "anatomy", "start"] as const;
export type OnboardingScreenKey = (typeof ONBOARDING_SCREEN_KEYS)[number];
const ONBOARDING_TOTAL = ONBOARDING_SCREEN_KEYS.length;

export default function OnboardingScreen({
  onComplete,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [gender, setGender] = React.useState<AnatomyType>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const screenOpacity = useRef(new RNAnimated.Value(0)).current;
  const lastScreenKeyRef = useRef<OnboardingScreenKey>("welcome");
  const lastIndexRef = useRef(0);
  const completedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const abandonedTrackedRef = useRef(false);

  const screenKey = ONBOARDING_SCREEN_KEYS[stepIndex];

  useEffect(() => {
    (async () => {
      try {
        const [progress, settings] = await Promise.all([
          storage.getOnboardingProgress(),
          storage.getSettings(),
        ]);
        if (
          settings.anatomyType === "male" ||
          settings.anatomyType === "female"
        ) {
          setGender(settings.anatomyType);
        }
        if (progress) {
          const idx = ONBOARDING_SCREEN_KEYS.indexOf(
            progress.screenKey as OnboardingScreenKey,
          );
          if (idx >= 0) {
            setStepIndex(idx);
          } else if (
            typeof progress.index === "number" &&
            progress.index >= 0 &&
            progress.index < ONBOARDING_TOTAL
          ) {
            setStepIndex(progress.index);
          }
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    lastScreenKeyRef.current = screenKey;
    lastIndexRef.current = stepIndex;
    void storage.saveOnboardingProgress(screenKey, stepIndex);
    trackOnboardingScreenViewed({
      screen_key: screenKey,
      index: stepIndex,
      total: ONBOARDING_TOTAL,
    });
    RNAnimated.timing(screenOpacity, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [hydrated, screenKey, stepIndex, screenOpacity]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      const leaving = prev === "active" && !!next.match(/inactive|background/);
      if (leaving && !completedRef.current && !abandonedTrackedRef.current) {
        abandonedTrackedRef.current = true;
        trackOnboardingAbandoned({
          last_screen_key: lastScreenKeyRef.current,
          index: lastIndexRef.current,
        });
      }
      if (didAppBecomeActive(prev, next)) {
        abandonedTrackedRef.current = false;
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  const fadeToIndex = useCallback(
    (nextIndex: number) => {
      RNAnimated.timing(screenOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => {
        setStepIndex(nextIndex);
      });
    },
    [screenOpacity],
  );

  const handleAnatomySelect = (g: "male" | "female") => {
    setGender(g);
    void storage.saveSettings({ anatomyType: g });
    trackOnboardingAnatomySelected({ anatomy: g });
  };

  const handleContinue = () => {
    if (stepIndex < ONBOARDING_TOTAL - 1) {
      fadeToIndex(stepIndex + 1);
      return;
    }
    void handleStart();
  };

  const handleStart = async () => {
    if (!gender || completedRef.current) return;
    completedRef.current = true;
    trackOnboardingCtaTapped({ screen_key: "start" });
    await storage.saveSettings({ anatomyType: gender });
    trackOnboardingComplete({ anatomyType: gender });
    await storage.setOnboardingComplete();
    await storage.setFirstSessionGateSource("post_onboarding");
    onComplete();
  };

  const accent = gender === "female" ? PINK : BLUE;
  const anatomyReady = gender === "male" || gender === "female";

  if (!hydrated) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  return (
    <RNAnimated.View style={[styles.root, { opacity: screenOpacity }]}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />

      {screenKey === "welcome" && (
        <WelcomeScreen
          insets={insets}
          onContinue={handleContinue}
          stepIndex={stepIndex}
        />
      )}
      {screenKey === "anatomy" && (
        <AnatomyScreen
          insets={insets}
          gender={gender}
          onSelect={handleAnatomySelect}
          onContinue={handleContinue}
          ctaEnabled={anatomyReady}
          stepIndex={stepIndex}
        />
      )}
      {screenKey === "start" && (
        <StartScreen
          insets={insets}
          gender={gender}
          accent={accent}
          onStart={handleContinue}
          stepIndex={stepIndex}
        />
      )}
    </RNAnimated.View>
  );
}

function StepDots({
  index,
  accent = BLUE,
}: {
  index: number;
  accent?: string;
}) {
  return (
    <View style={styles.dotRow}>
      {ONBOARDING_SCREEN_KEYS.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index
              ? { backgroundColor: accent, width: 20 }
              : { backgroundColor: TEXT_MUTED, width: 8 },
          ]}
        />
      ))}
    </View>
  );
}

function WelcomeScreen({
  insets,
  onContinue,
  stepIndex,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  onContinue: () => void;
  stepIndex: number;
}) {
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.genderHeader}>
        <Text style={styles.logoText}>
          <Text style={{ color: TEXT }}>PULSE</Text>
          <Text style={{ color: BLUE }}>KEGEL</Text>
        </Text>
        <Text style={styles.logoTagline}>SHORT SESSIONS. CLEAR GUIDANCE.</Text>
      </View>

      <View style={styles.genderHeroRow}>
        <Image
          source={HERO_COMBINED}
          style={styles.genderHeroImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.genderTextBlock}>
        <Text style={styles.genderHeadline}>
          Train your pelvic floor in a few minutes a day.
        </Text>
        <Text style={styles.genderSubline}>
          We will keep Day 1 short, clear, and coach-guided.
        </Text>
      </View>

      <StepDots index={stepIndex} />

      <StickyPrimaryButton
        label="Continue"
        accent={BLUE}
        onPress={onContinue}
        testID="button-onboarding-welcome-continue"
      />
    </View>
  );
}

function AnatomyScreen({
  insets,
  gender,
  onSelect,
  onContinue,
  ctaEnabled,
  stepIndex,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  gender: AnatomyType;
  onSelect: (g: "male" | "female") => void;
  onContinue: () => void;
  ctaEnabled: boolean;
  stepIndex: number;
}) {
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.genderHeader}>
        <Text style={styles.logoText}>
          <Text style={{ color: TEXT }}>PULSE</Text>
          <Text style={{ color: BLUE }}>KEGEL</Text>
        </Text>
        <Text style={styles.logoTagline}>PICK YOUR GUIDE</Text>
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.genderHeadline}>Which anatomy guide fits you?</Text>
        <Text style={[styles.genderSubline, { marginBottom: 24 }]}>
          This personalizes cues. Nothing is selected yet.
        </Text>

        <View style={styles.genderButtons}>
          <GenderButton
            label="Male"
            icon="male"
            color={BLUE}
            dimColor={BLUE_DIM}
            borderColor={BLUE_BORDER}
            selected={gender === "male"}
            onPress={() => onSelect("male")}
            testID="button-gender-man"
          />
          <GenderButton
            label="Female"
            icon="female"
            color={PINK}
            dimColor={PINK_DIM}
            borderColor={PINK_BORDER}
            selected={gender === "female"}
            onPress={() => onSelect("female")}
            testID="button-gender-woman"
          />
        </View>
      </View>

      <StepDots index={stepIndex} accent={gender === "female" ? PINK : BLUE} />

      <StickyPrimaryButton
        label="Continue"
        accent={gender === "female" ? PINK : BLUE}
        onPress={onContinue}
        disabled={!ctaEnabled}
        testID="button-onboarding-anatomy-continue"
      />
    </View>
  );
}

function StartScreen({
  insets,
  gender,
  accent,
  onStart,
  stepIndex,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  gender: AnatomyType;
  accent: string;
  onStart: () => void;
  stepIndex: number;
}) {
  const isMale = gender !== "female";
  const HERO_H = Math.min(height * 0.42, 360);

  return (
    <View style={[styles.screenFlush, { paddingBottom: insets.bottom + 16 }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.ctaHeroContainer, { height: HERO_H }]}>
          <Image
            source={isMale ? MAN_HERO : WOMAN_HERO}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
          <LinearGradient
            colors={["transparent", BG_GRADIENT[1]]}
            style={[StyleSheet.absoluteFill, { top: "55%" }]}
          />
          <View style={[styles.ctaLogoOverlay, { top: insets.top + 12 }]}>
            <Text style={styles.logoText}>
              <Text style={{ color: TEXT }}>PULSE</Text>
              <Text style={{ color: accent }}>KEGEL</Text>
            </Text>
          </View>
        </View>

        <View style={styles.ctaContent}>
          <Text style={styles.ctaHeadline}>
            Day 1 is a short guided session.
          </Text>
          <Text style={[styles.ctaSubline, { color: accent }]}>
            Stay with the cues — we will keep it clear and encouraging.
          </Text>
          <Text style={styles.benefitSub}>
            About {isMale ? "5–8" : "5–8"} minutes. Private on your device.
          </Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: Spacing.xl }}>
        <StepDots index={stepIndex} accent={accent} />
        <StickyPrimaryButton
          label="Start Day 1"
          accent={accent}
          icon="send"
          onPress={onStart}
          testID="button-start-day-1"
        />
      </View>
    </View>
  );
}

function GenderButton({
  label,
  icon,
  color,
  dimColor,
  borderColor,
  selected,
  onPress,
  testID,
}: {
  label: string;
  icon: string;
  color: string;
  dimColor: string;
  borderColor: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const labelColor = selected ? "#fff" : color;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.genderBtn,
        selected
          ? {
              backgroundColor: pressed ? color + "CC" : color,
              borderColor: color,
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 14,
              elevation: 10,
            }
          : {
              backgroundColor: pressed ? color + "22" : dimColor,
              borderColor: pressed ? color : borderColor,
            },
      ]}
    >
      <Text style={[styles.genderBtnSymbol, { color: labelColor }]}>
        {icon === "male" ? "♂" : "♀"}
      </Text>
      <Text style={[styles.genderBtnLabel, { color: labelColor }]}>
        {label}
      </Text>
      {selected ? (
        <Feather name="check" size={18} color={labelColor} />
      ) : (
        <Feather
          name="chevron-right"
          size={18}
          color={labelColor}
          style={{ marginLeft: "auto" }}
        />
      )}
    </Pressable>
  );
}

function StickyPrimaryButton({
  label,
  accent,
  icon,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  accent: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.primaryBtnWrapper,
        animStyle,
        disabled ? { opacity: 0.38 } : null,
      ]}
    >
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          if (disabled) return;
          scale.value = withTiming(0.97, {
            duration: ANIM_DURATION_RESET_FAST,
          });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: ANIM_DURATION_MICRO });
        }}
        style={[
          styles.primaryBtn,
          { backgroundColor: accent, shadowColor: accent },
        ]}
      >
        {icon ? (
          <Feather
            name={icon as "send"}
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
        ) : null}
        <Text style={styles.primaryBtnText}>{label}</Text>
        <Feather
          name="chevron-right"
          size={18}
          color="#fff"
          style={{ marginLeft: 4 }}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  screenFlush: {
    flex: 1,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  logoTagline: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.8,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 2,
  },
  genderHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  genderHeroRow: {
    flex: 1,
    overflow: "hidden",
    borderRadius: BorderRadius.lg,
    marginHorizontal: -Spacing.xl,
  },
  genderHeroImage: {
    width: "100%",
    height: "100%",
  },
  genderTextBlock: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  genderHeadline: {
    fontSize: 24,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    lineHeight: 32,
  },
  genderSubline: {
    fontSize: 16,
    color: TEXT_SEC,
    textAlign: "center",
    marginTop: 8,
  },
  genderButtons: {
    gap: 12,
  },
  genderBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  genderBtnSymbol: {
    fontSize: 22,
    fontWeight: "700",
  },
  genderBtnLabel: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
    marginTop: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  primaryBtnWrapper: {
    width: "100%",
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  ctaHeroContainer: {
    width,
    overflow: "hidden",
  },
  ctaLogoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ctaContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 8,
    gap: 10,
  },
  ctaHeadline: {
    fontSize: 24,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    lineHeight: 32,
  },
  ctaSubline: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  benefitSub: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 4,
  },
});
