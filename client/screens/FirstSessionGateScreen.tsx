import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Crypto from "expo-crypto";

import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_MICRO,
  ANIM_DURATION_RESET_FAST,
} from "@/constants/animation";
import { storage } from "@/lib/storage";
import {
  FIRST_SESSION_VARIANT_SHORT_DAY1,
  FirstSessionVariant,
  getFirstSessionPlannedSteps,
  getFirstSessionWorkout,
} from "@/data/workoutProgram";
import { getLaunchType } from "@/lib/activationDiagnostics";
import {
  FirstSessionGateSource,
  trackFirstSessionCtaTapped,
  trackFirstSessionGateShown,
  trackFirstSessionRestartTapped,
  trackFirstSessionResumeShown,
  trackFirstSessionResumeTapped,
  trackFirstSessionStarted,
  trackSettingsTipDismissed,
  trackSettingsTipOpenSettings,
  trackSettingsTipShown,
} from "@/lib/analytics";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FirstSessionGateScreenProps {
  onUnlocked: () => void;
  /** F2: short first-win path (default). */
  variant?: FirstSessionVariant;
  /** Optional override for planned segment count (analytics / UI). */
  planned_steps?: number;
  /** Optional completed segment count when resuming. */
  completed_steps?: number;
}

const BLUE = "#00AAFF";
const TEXT = "#F0F2FF";
const TEXT_SEC = "rgba(240,242,255,0.65)";
const TEXT_MUTED = "rgba(240,242,255,0.38)";
const BG_GRADIENT: [string, string, string, string] = [
  "#07081A",
  "#0A0B22",
  "#0D0E28",
  "#070818",
];

const { width } = Dimensions.get("window");

export default function FirstSessionGateScreen({
  onUnlocked,
  variant = FIRST_SESSION_VARIANT_SHORT_DAY1,
  planned_steps,
  completed_steps,
}: FirstSessionGateScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const [source, setSource] = useState<FirstSessionGateSource>("cold_open");
  const [resume, setResume] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [stateLost, setStateLost] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [showSettingsTip, setShowSettingsTip] = useState(false);
  const [ready, setReady] = useState(false);
  const gateShownRef = useRef(false);
  const resumeShownRef = useRef(false);
  const tipShownTrackedRef = useRef(false);
  const tipWasShownRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const workout = getFirstSessionWorkout(variant);
  const plannedSteps = planned_steps ?? getFirstSessionPlannedSteps(workout);
  const completedSteps = completed_steps ?? stepIndex;

  const hydrate = useCallback(async () => {
    const [
      completed,
      inProgress,
      celebrated,
      pendingSource,
      existingId,
      tipSeen,
      savedStep,
    ] = await Promise.all([
      storage.hasCompletedFirstSession(),
      storage.isFirstSessionInProgress(),
      storage.hasCelebratedFirstSession(),
      storage.peekFirstSessionGateSource(),
      storage.getFirstSessionId(),
      storage.hasSettingsTipSeen(),
      storage.getFirstSessionStepIndex(),
    ]);
    if (existingId) {
      sessionIdRef.current = existingId;
    }

    if (completed) {
      if (!celebrated) {
        setCelebrating(true);
        const shouldShowTip = !tipSeen;
        setShowSettingsTip(shouldShowTip);
        if (shouldShowTip) {
          tipWasShownRef.current = true;
        }
        setReady(true);
        return;
      }
      onUnlocked();
      return;
    }

    let nextSource: FirstSessionGateSource = "cold_open";
    let nextResume = false;
    let nextStep = 0;
    let lost = false;

    if (inProgress) {
      nextSource = "resume";
      nextResume = true;
      if (typeof savedStep === "number" && savedStep >= 0) {
        nextStep = Math.min(savedStep, Math.max(0, plannedSteps - 1));
      } else {
        // In progress but step state missing — offer start over.
        lost = true;
        nextStep = 0;
      }
      if (!existingId) {
        lost = true;
      }
    } else if (pendingSource) {
      nextSource = pendingSource;
    }

    setSource(nextSource);
    setResume(nextResume);
    setStepIndex(nextStep);
    setStateLost(lost);
    setReady(true);

    if (!gateShownRef.current) {
      gateShownRef.current = true;
      trackFirstSessionGateShown({ source: nextSource });
    }

    if (nextResume && !resumeShownRef.current) {
      resumeShownRef.current = true;
      const launch = getLaunchType();
      trackFirstSessionResumeShown({
        source: launch === "warm" ? "warm" : "cold",
        step_index: nextStep,
      });
    }
  }, [onUnlocked, plannedSteps]);

  useEffect(() => {
    if (isFocused) {
      void hydrate();
    }
  }, [isFocused, hydrate]);

  useEffect(() => {
    if (celebrating && showSettingsTip && !tipShownTrackedRef.current) {
      tipShownTrackedRef.current = true;
      tipWasShownRef.current = true;
      trackSettingsTipShown();
    }
  }, [celebrating, showSettingsTip]);

  const finishCelebration = async () => {
    await storage.markFirstSessionCelebrated();
    setCelebrating(false);
    onUnlocked();
  };

  const handleTipDismiss = async () => {
    await storage.markSettingsTipSeen();
    setShowSettingsTip(false);
    trackSettingsTipDismissed();
  };

  const handleOpenSettings = async () => {
    await storage.markSettingsTipSeen();
    await storage.setPendingOpenSettings(true);
    setShowSettingsTip(false);
    trackSettingsTipOpenSettings();
    await finishCelebration();
  };

  const handleContinue = async () => {
    if (tipWasShownRef.current || showSettingsTip) {
      await storage.markSettingsTipSeen();
      setShowSettingsTip(false);
    }
    await finishCelebration();
  };

  const launchSession = async (opts: {
    resumeMode: boolean;
    startStep: number;
    restartReason?: string;
  }) => {
    const { resumeMode, startStep, restartReason } = opts;

    if (resumeMode) {
      trackFirstSessionResumeTapped({ step_index: startStep });
    } else if (restartReason) {
      trackFirstSessionRestartTapped({ reason: restartReason });
      trackFirstSessionCtaTapped({ source: "cold_open" });
    } else {
      trackFirstSessionCtaTapped({ source });
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const existingStart = await storage.getProgramStartDate();
    if (!existingStart) {
      await storage.setProgramStartDate(todayStr);
    }

    let sessionId = sessionIdRef.current ?? (await storage.getFirstSessionId());
    if (!sessionId || restartReason) {
      sessionId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${todayStr}-${Date.now()}`,
      ).catch(() => `fs-${Date.now()}`);
    }
    sessionIdRef.current = sessionId;

    const safeStep = Math.max(0, Math.min(startStep, plannedSteps - 1));

    await storage.setFirstSessionId(sessionId);
    await storage.setFirstSessionInProgress(true, 0, safeStep);
    await storage.clearFirstSessionGateSource();
    trackFirstSessionStarted({ session_id: sessionId });

    navigation.navigate("WorkoutPlayer", {
      workout,
      weekNumber: 1,
      phase: "Control",
      dayNumber: 1,
      isFirstSession: true,
      firstSessionId: sessionId,
      resumeStepIndex: resumeMode ? safeStep : 0,
      variant: FIRST_SESSION_VARIANT_SHORT_DAY1,
      plannedSteps,
      completedSteps: resumeMode ? safeStep : 0,
    });
  };

  const handleStart = async () => {
    await launchSession({ resumeMode: false, startStep: 0 });
  };

  const handleResume = async () => {
    await launchSession({
      resumeMode: true,
      startStep: stepIndex,
    });
  };

  const handleStartOver = async () => {
    await launchSession({
      resumeMode: false,
      startStep: 0,
      restartReason: stateLost ? "state_lost" : "user_choice",
    });
  };

  if (!ready) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  if (celebrating) {
    return (
      <View
        style={[
          styles.root,
          styles.centered,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: Spacing.xl,
          },
        ]}
      >
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
        <View style={styles.badge}>
          <Feather name="check-circle" size={42} color={BLUE} />
        </View>
        <Text style={styles.headline}>Nice work — Day 1 done.</Text>
        <Text style={styles.subline}>
          Your full program is unlocked. Day 2 of 7 unlocks tomorrow — we will
          remind you.
        </Text>

        {showSettingsTip ? (
          <View style={styles.tipCard} testID="card-settings-tip">
            <View style={styles.tipIconRow}>
              <Feather name="settings" size={16} color={BLUE} />
              <Text style={styles.tipCopy}>
                Rest, haptics, and music live in Settings.
              </Text>
            </View>
            <View style={styles.tipActions}>
              <Pressable
                onPress={() => {
                  void handleTipDismiss();
                }}
                style={styles.tipQuietBtn}
                testID="button-settings-tip-got-it"
              >
                <Text style={styles.tipQuietBtnText}>Got it</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handleOpenSettings();
                }}
                style={styles.tipPrimaryBtn}
                testID="button-settings-tip-open-settings"
              >
                <Text style={styles.tipPrimaryBtnText}>Open Settings</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <PrimaryButton
          label="Continue"
          onPress={() => {
            void handleContinue();
          }}
          testID="button-first-session-celebration-continue"
        />
      </View>
    );
  }

  if (resume) {
    return (
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: Spacing.xl,
          },
        ]}
      >
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <Text style={styles.logoText}>
            <Text style={{ color: TEXT }}>PULSE</Text>
            <Text style={{ color: BLUE }}>KEGEL</Text>
          </Text>
          <Text style={styles.kicker}>DAY 1 · RESUME</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.ring}>
            <Feather name="play-circle" size={36} color={BLUE} />
          </View>
          <Text style={styles.headline}>Continue where you left off</Text>
          <Text style={styles.subline}>
            {stateLost
              ? "We could not restore your exact step. You can start over — still a short first win."
              : `Pick up at step ${Math.min(completedSteps + 1, plannedSteps)} of ${plannedSteps}. One clear win unlocks the full menu.`}
          </Text>
          <Text style={styles.meta}>
            About {workout.estimatedMinutes} min · Coach cues only — not medical
            advice
          </Text>
        </View>

        {stateLost ? (
          <PrimaryButton
            label="Start over"
            onPress={() => {
              void handleStartOver();
            }}
            testID="button-first-session-start-over"
          />
        ) : (
          <>
            <PrimaryButton
              label="Continue where you left off"
              onPress={() => {
                void handleResume();
              }}
              testID="button-first-session-resume-cta"
            />
            <Pressable
              onPress={() => {
                void handleStartOver();
              }}
              style={styles.secondaryBtn}
              testID="button-first-session-start-over"
            >
              <Text style={styles.secondaryBtnText}>Start over</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: Spacing.xl,
        },
      ]}
    >
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.logoText}>
          <Text style={{ color: TEXT }}>PULSE</Text>
          <Text style={{ color: BLUE }}>KEGEL</Text>
        </Text>
        <Text style={styles.kicker}>DAY 1</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.ring}>
          <Feather name="play" size={36} color={BLUE} />
        </View>
        <Text style={styles.headline}>Start your first session</Text>
        <Text style={styles.subline}>
          Intro, one clear win, then you unlock the full menu. Short and clear —
          coach cues only.
        </Text>
        <Text style={styles.meta}>
          About {workout.estimatedMinutes} min · {plannedSteps} steps · Not
          medical advice
        </Text>
      </View>

      <PrimaryButton
        label="Start your first session"
        onPress={() => {
          void handleStart();
        }}
        testID="button-first-session-cta"
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.primaryBtnWrapper, animStyle]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.97, {
            duration: ANIM_DURATION_RESET_FAST,
          });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: ANIM_DURATION_MICRO });
        }}
        style={styles.primaryBtn}
      >
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
  centered: {
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  kicker: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: BLUE,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 14,
  },
  ring: {
    width: Math.min(width * 0.28, 120),
    height: Math.min(width * 0.28, 120),
    borderRadius: 999,
    borderWidth: 2,
    borderColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,170,255,0.12)",
    marginBottom: 8,
  },
  badge: {
    alignItems: "center",
    marginBottom: 18,
  },
  headline: {
    fontSize: 26,
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
    lineHeight: 34,
  },
  subline: {
    fontSize: 16,
    color: TEXT_SEC,
    textAlign: "center",
    lineHeight: 24,
  },
  meta: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 4,
  },
  tipCard: {
    width: "100%",
    marginTop: 20,
    marginBottom: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(0,170,255,0.28)",
    backgroundColor: "rgba(0,170,255,0.08)",
    gap: 12,
  },
  tipIconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipCopy: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SEC,
    fontWeight: "600",
  },
  tipActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  tipQuietBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tipQuietBtnText: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: "600",
  },
  tipPrimaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(0,170,255,0.22)",
  },
  tipPrimaryBtnText: {
    color: BLUE,
    fontSize: 14,
    fontWeight: "700",
  },
  primaryBtnWrapper: {
    width: "100%",
    marginTop: 16,
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: BLUE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryBtn: {
    width: "100%",
    marginTop: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    color: TEXT_MUTED,
    fontSize: 15,
    fontWeight: "600",
  },
});
