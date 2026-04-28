import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  AppState,
  AppStateStatus,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useKeepAwake } from "expo-keep-awake";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  useSharedValue,
  runOnJS,
  FadeIn,
  ZoomIn,
  interpolateColor,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { PowerBar } from "@/components/PowerBar";
import { CircularProgressRing } from "@/components/CircularProgressRing";
import { FormTipsSheet } from "@/components/FormTipsSheet";
import { BadgeToast } from "@/components/BadgeToast";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_EXIT,
  ANIM_DURATION_EXIT_COMPLETE,
  ANIM_DURATION_ENTER,
  ANIM_DURATION_MICRO_SETTLE,
  ANIM_DURATION_ZOOM_ENTER,
  ANIM_DURATION_PROGRESS_FAST,
  ANIM_DURATION_PROGRESS_SLOW,
  ANIM_DELAY_MED,
  ANIM_DELAY_XL,
} from "@/constants/animation";
import { Segment, isRestDayForDate } from "@/data/workoutProgram";
import { WorkoutEngine, WorkoutState, WorkoutPhase } from "@/lib/workoutEngine";
import { hapticsManager, HapticPulseController } from "@/lib/hapticsManager";
import { storage, UserSettings, defaultSettings } from "@/lib/storage";
import { useAudio } from "@/contexts/AudioContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  rescheduleAfterCompletion,
  sendBadgeEarnedNotification,
} from "@/lib/notifications";
import { getBadgeById } from "@/data/badges";
import { trackSessionComplete } from "@/lib/analytics";

type RouteProps = RouteProp<RootStackParamList, "WorkoutPlayer">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutPlayerScreen() {
  useKeepAwake();

  const insets = useSafeAreaInsets();
  const { cp, isDarkMode } = useThemePreference();
  const { playSfx, startAmbient, stopAmbient } = useAudio();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { workout, weekNumber, phase, dayNumber } = route.params;

  const [workoutState, setWorkoutState] = useState<WorkoutState | null>(null);
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [currentPhase, setCurrentPhase] = useState<WorkoutPhase>("squeeze");
  const [setInfo, setSetInfo] = useState({ current: 1, total: 1 });
  const [repInfo, setRepInfo] = useState({ current: 1, total: 1 });
  const [progress, setProgress] = useState({ current: 0, total: 1 });
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [showTips, setShowTips] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [phaseDuration, setPhaseDuration] = useState(3);
  const [newBadgeIds, setNewBadgeIds] = useState<string[]>([]);

  const engineRef = useRef<WorkoutEngine | null>(null);
  const hapticPulseRef = useRef<HapticPulseController>(
    new HapticPulseController(),
  );
  const appStateRef = useRef(AppState.currentState);
  const startTimeRef = useRef<Date | null>(null);

  const phaseScale = useSharedValue(1);
  const phaseOpacity = useSharedValue(1);
  const glowPulse = useSharedValue(0);
  const backgroundPulse = useSharedValue(0);
  const phaseColorValue = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  const loadSettings = useCallback(async () => {
    const userSettings = await storage.getSettings();
    setSettings(userSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withTiming(1, { duration: ANIM_DURATION_PROGRESS_FAST }),
      -1,
      true,
    );
    backgroundPulse.value = withRepeat(
      withTiming(1, { duration: ANIM_DURATION_PROGRESS_SLOW }),
      -1,
      true,
    );
  }, [glowPulse, backgroundPulse]);

  useEffect(() => {
    return () => {
      hapticPulseRef.current.stop();
    };
  }, []);

  useEffect(() => {
    startTimeRef.current = new Date();

    const workoutSettings = {
      restDuration: settings.restDuration,
      blockRestDuration: settings.blockRestDuration,
      cooldownEnabled: settings.cooldownEnabled,
    };

    const engine = new WorkoutEngine(
      workout,
      {
        onStateChange: (state) => {
          setWorkoutState(state);
          if (engine) {
            setProgress(engine.getProgress());
          }
        },
        onPhaseChange: async (newPhase, segment) => {
          setCurrentPhase(newPhase);

          phaseColorValue.value = withTiming(newPhase === "squeeze" ? 1 : 0, {
            duration: ANIM_DURATION_ENTER,
          });

          const duration =
            newPhase === "squeeze"
              ? segment.squeezeSeconds
              : segment.restSeconds;
          setPhaseDuration(duration);

          phaseScale.value = 0.8;
          phaseOpacity.value = 0.5;
          phaseScale.value = withSpring(1, { damping: 12, stiffness: 200 });
          phaseOpacity.value = withTiming(1, {
            duration: ANIM_DURATION_MICRO_SETTLE,
          });

          if (newPhase === "squeeze") {
            playSfx("squeeze");
            hapticPulseRef.current.start(
              segment.type,
              settings,
              segment.squeezeSeconds,
              segment.rampSteps,
            );
          } else {
            playSfx(segment.type === "breathing" ? "breathe" : "rest");
            hapticPulseRef.current.triggerTransitionCue();
            hapticPulseRef.current.stop();
          }
        },
        onSegmentChange: (segment) => {
          setCurrentSegment(segment);
          setPhaseDuration(segment.squeezeSeconds);

          if (hapticPulseRef.current.isActive()) {
            hapticPulseRef.current.updateSegmentType(
              segment.type,
              segment.squeezeSeconds,
              segment.rampSteps,
            );
          }
        },
        onSetChange: (current, total) => {
          setSetInfo({ current, total });
        },
        onRepChange: (current, total) => {
          setRepInfo({ current, total });
        },
        onComplete: async (seconds) => {
          hapticPulseRef.current.stop();
          stopAmbient();
          playSfx("complete");
          setTotalSeconds(seconds);
          setIsComplete(true);
          await hapticsManager.triggerComplete(settings);

          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const minutes = Math.ceil(seconds / 60);
          await storage.addCompletedDate(today, minutes);
          trackSessionComplete({
            durationMinutes: minutes,
            workoutType: workout.dayType,
            weekNumber,
            dayNumber,
          });

          const startDate = await storage.getProgramStartDate();
          if (!startDate) {
            await storage.setProgramStartDate(today);
          }

          const effectiveStartDate = startDate || today;
          const startParts = effectiveStartDate.split("-").map(Number);
          const startDateObj = new Date(
            startParts[0],
            startParts[1] - 1,
            startParts[2],
          );
          const todayDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          const daysSinceStart = Math.floor(
            (todayDate.getTime() - startDateObj.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (daysSinceStart < 7 && isRestDayForDate(now, effectiveStartDate)) {
            await storage.markChallengeOptionalSession(today);
          }

          await rescheduleAfterCompletion();

          const awarded = await storage.checkAndAwardBadges();
          if (awarded.length > 0) {
            setNewBadgeIds(awarded);
            for (const badgeId of awarded) {
              const badge = getBadgeById(badgeId);
              if (badge) {
                sendBadgeEarnedNotification(badge.name);
              }
            }
          }
        },
        onTick: () => {},
      },
      workoutSettings,
    );

    engineRef.current = engine;
    setCurrentSegment(engine.getCurrentSegment());

    const firstSegment = engine.getCurrentSegment();
    if (firstSegment) {
      setPhaseDuration(firstSegment.squeezeSeconds);
    }

    engine.start();
    startAmbient();

    return () => {
      hapticPulseRef.current.stop();
      stopAmbient();
      engine.destroy();
    };
  }, [workout, settings, phaseScale, phaseOpacity, phaseColorValue]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          engineRef.current?.handleAppForeground();

          if (
            currentPhase === "squeeze" &&
            currentSegment &&
            workoutState?.isRunning &&
            !workoutState?.isPaused
          ) {
            hapticPulseRef.current.start(
              currentSegment.type,
              settings,
              currentSegment.squeezeSeconds,
              currentSegment.rampSteps,
            );
          }
        } else if (nextAppState.match(/inactive|background/)) {
          hapticPulseRef.current.stop();
        }
        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    currentPhase,
    currentSegment,
    settings,
    workoutState?.isRunning,
    workoutState?.isPaused,
  ]);

  const handlePauseResume = async () => {
    if (!engineRef.current || !workoutState) return;

    await hapticsManager.triggerSelection();

    if (workoutState.isPaused) {
      engineRef.current.resume();
      if (currentPhase === "squeeze" && currentSegment) {
        hapticPulseRef.current.start(
          currentSegment.type,
          settings,
          currentSegment.squeezeSeconds,
          currentSegment.rampSteps,
        );
      }
    } else {
      engineRef.current.pause();
      hapticPulseRef.current.stop();
    }
  };

  const handleSkip = async () => {
    if (!engineRef.current) return;
    await hapticsManager.triggerSelection();
    hapticPulseRef.current.stop();
    engineRef.current.skipSegment();
  };

  const doGoBack = () => {
    navigation.goBack();
  };

  const animateOut = (duration: number) => {
    "worklet";
    screenOpacity.value = withTiming(0, { duration }, (finished) => {
      if (finished) {
        runOnJS(doGoBack)();
      }
    });
  };

  const handleEnd = async () => {
    if (!engineRef.current) return;
    await hapticsManager.triggerWarning();
    hapticPulseRef.current.stop();
    animateOut(ANIM_DURATION_EXIT);
  };

  const handleClose = () => {
    hapticPulseRef.current.stop();
    animateOut(isComplete ? ANIM_DURATION_EXIT_COMPLETE : ANIM_DURATION_EXIT);
  };

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const phaseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: phaseScale.value }],
    opacity: phaseOpacity.value,
  }));

  const phaseLabelStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      phaseColorValue.value,
      [0, 1],
      [cp.neonCyan, cp.neonGreen],
    );
    if (isDarkMode) {
      return {
        color,
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
      };
    }
    return {
      color,
      textShadowColor: "transparent",
      textShadowRadius: 0,
    };
  });

  const countdownStyle = useAnimatedStyle(() => {
    const glowIntensity = 0.5 + glowPulse.value * 0.5;
    const color = interpolateColor(
      phaseColorValue.value,
      [0, 1],
      [cp.neonCyan, cp.neonGreen],
    );
    if (isDarkMode) {
      return {
        color,
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 30 * glowIntensity,
      };
    }
    return {
      color,
      textShadowColor: "transparent",
      textShadowRadius: 0,
    };
  });

  const ringProgress =
    progress.total > 0 ? progress.current / progress.total : 0;

  const getPhaseLabel = () => {
    if (currentSegment?.type === "getReady") {
      return `STARTING IN ${workoutState?.secondsRemaining || 5}`;
    }
    if (currentSegment?.type === "blockRest") return "BREATHE";
    if (currentPhase === "squeeze") {
      return currentSegment?.type === "reverse" ? "GENTLE PUSH" : "SQUEEZE";
    }
    return "REST";
  };

  const getExerciseDescription = () => {
    if (!currentSegment) return "";
    switch (currentSegment.type) {
      case "slowHolds":
        return "Tighten and hold steadily";
      case "quickFlicks":
        return "Quick contract and release";
      case "elevator":
        return "Gradually increase tension";
      case "reverse":
        return "Gently push outward";
      case "contractRelax":
        return "Contract then fully relax";
      case "breathing":
        return "Deep belly breaths";
      case "blockRest":
        return "Relax and breathe deeply";
      case "getReady":
        return "Prepare for the next exercise";
      default:
        return "";
    }
  };

  if (isComplete) {
    return (
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: cp.bg },
          screenAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={cp.gradient as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + Spacing["3xl"],
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <ThemedText type="h4" style={{ color: cp.text }}>
              Complete
            </ThemedText>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Feather name="x" size={24} color={cp.text} />
            </Pressable>
          </View>

          <View style={styles.completeContent}>
            <Animated.View
              entering={ZoomIn.duration(ANIM_DURATION_ZOOM_ENTER)}
              style={[
                styles.completeIcon,
                { backgroundColor: `${cp.neonGreen}20` },
              ]}
            >
              <Feather name="check-circle" size={80} color={cp.neonGreen} />
            </Animated.View>

            <Animated.View entering={FadeIn.delay(ANIM_DELAY_MED)}>
              <ThemedText
                type="h1"
                style={[styles.completeTitle, { color: cp.text }]}
              >
                Great Job!
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.completeSubtitle, { color: cp.textSecondary }]}
              >
                {"You completed today's workout"}
              </ThemedText>
            </Animated.View>

            <Animated.View
              entering={FadeIn.delay(ANIM_DELAY_XL)}
              style={styles.completeStats}
            >
              <View
                style={[
                  styles.completeStat,
                  {
                    backgroundColor: cp.cardBg,
                    borderColor: cp.cardBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="clock" size={24} color={cp.neonCyan} />
                <ThemedText
                  type="h3"
                  style={{ marginTop: Spacing.sm, color: cp.text }}
                >
                  {Math.ceil(totalSeconds / 60)}
                </ThemedText>
                <ThemedText type="small" style={{ color: cp.textSecondary }}>
                  Minutes
                </ThemedText>
              </View>

              <View
                style={[
                  styles.completeStat,
                  {
                    backgroundColor: cp.cardBg,
                    borderColor: cp.cardBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="target" size={24} color={cp.neonPink} />
                <ThemedText
                  type="h3"
                  style={{ marginTop: Spacing.sm, color: cp.text }}
                >
                  {workout.segments.reduce(
                    (acc, s) => acc + s.sets * s.repsPerSet,
                    0,
                  )}
                </ThemedText>
                <ThemedText type="small" style={{ color: cp.textSecondary }}>
                  Reps
                </ThemedText>
              </View>
            </Animated.View>
          </View>

          <Pressable
            onPress={handleClose}
            style={[styles.doneButton, { backgroundColor: cp.neonGreen }]}
          >
            <ThemedText
              type="body"
              style={{ color: "#000", fontWeight: "700" }}
            >
              Done
            </ThemedText>
          </Pressable>
        </View>

        {newBadgeIds.length > 0 ? (
          <BadgeToast
            badgeIds={newBadgeIds}
            onDismiss={() => setNewBadgeIds([])}
          />
        ) : null}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: cp.bg },
        screenAnimatedStyle,
      ]}
    >
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <Feather name="x" size={24} color={cp.text} />
          </Pressable>
          <ThemedText type="small" style={{ color: cp.textMuted }}>
            Week {weekNumber} - {phase}
          </ThemedText>
          <Pressable
            onPress={() => setShowTips(true)}
            style={styles.headerButton}
          >
            <Feather name="help-circle" size={24} color={cp.text} />
          </Pressable>
        </View>

        <View style={styles.mainContent}>
          <Animated.View style={phaseAnimatedStyle}>
            <Animated.Text
              style={[
                styles.phaseLabel,
                currentSegment?.type === "getReady"
                  ? {
                      color: cp.neonCyan,
                      fontSize: 36,
                      ...(isDarkMode
                        ? {
                            textShadowColor: cp.neonCyan,
                            textShadowOffset: { width: 0, height: 0 },
                            textShadowRadius: 20,
                          }
                        : {}),
                    }
                  : currentSegment?.type === "blockRest"
                    ? {
                        color: cp.neonPurple,
                        ...(isDarkMode
                          ? {
                              textShadowColor: cp.neonPurple,
                              textShadowOffset: { width: 0, height: 0 },
                              textShadowRadius: 20,
                            }
                          : {}),
                      }
                    : phaseLabelStyle,
              ]}
            >
              {getPhaseLabel()}
            </Animated.Text>
          </Animated.View>

          {isDarkMode ? (
            <View style={styles.powerBarContainer}>
              <PowerBar
                phase={currentPhase}
                segmentType={currentSegment?.type || "slowHolds"}
                durationSeconds={phaseDuration}
                isActive={Boolean(
                  workoutState?.isRunning &&
                    !workoutState?.isPaused &&
                    currentSegment?.type !== "getReady",
                )}
                height={300}
                width={120}
                rampSteps={currentSegment?.rampSteps}
              />
              {currentSegment?.type !== "getReady" ? (
                <View style={styles.countdownContainer}>
                  <Animated.Text style={[styles.countdown, countdownStyle]}>
                    {workoutState?.secondsRemaining || 0}
                  </Animated.Text>
                  <ThemedText
                    type="small"
                    style={[styles.countdownLabel, { color: cp.textMuted }]}
                  >
                    {(workoutState?.secondsRemaining || 0) === 1
                      ? "second"
                      : "seconds"}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.circularContainer}>
              <CircularProgressRing
                phase={currentPhase}
                segmentType={currentSegment?.type || "slowHolds"}
                durationSeconds={phaseDuration}
                isActive={Boolean(
                  workoutState?.isRunning &&
                    !workoutState?.isPaused &&
                    currentSegment?.type !== "getReady",
                )}
                size={220}
                strokeWidth={16}
                rampSteps={currentSegment?.rampSteps}
              >
                {currentSegment?.type !== "getReady" ? (
                  <View style={styles.ringCountdownContainer}>
                    <Animated.Text
                      style={[styles.ringCountdown, { color: cp.text }]}
                    >
                      {workoutState?.secondsRemaining || 0}
                    </Animated.Text>
                    <ThemedText
                      type="small"
                      style={[
                        styles.ringCountdownLabel,
                        { color: cp.textMuted },
                      ]}
                    >
                      {(workoutState?.secondsRemaining || 0) === 1
                        ? "second"
                        : "seconds"}
                    </ThemedText>
                  </View>
                ) : null}
              </CircularProgressRing>
            </View>
          )}

          <View style={styles.segmentInfo}>
            <ThemedText
              type="h4"
              style={[styles.segmentName, { color: cp.text }]}
            >
              {currentSegment?.type === "getReady"
                ? "Get Ready"
                : currentSegment?.name || ""}
            </ThemedText>
            <Text style={[styles.exerciseDescription, { color: cp.textMuted }]}>
              {getExerciseDescription()}
            </Text>
            {currentSegment?.type !== "getReady" ? (
              <ThemedText
                type="body"
                style={[styles.segmentDetail, { color: cp.textMuted }]}
              >
                Set {setInfo.current} of {setInfo.total} • Rep {repInfo.current}{" "}
                of {repInfo.total}
              </ThemedText>
            ) : (
              <ThemedText
                type="body"
                style={[styles.segmentDetail, { color: cp.textMuted }]}
              >
                Prepare for your workout
              </ThemedText>
            )}
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[styles.progressBar, { backgroundColor: cp.cardBorder }]}
            >
              <LinearGradient
                colors={[cp.neonGreen, cp.neonCyan]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${ringProgress * 100}%` },
                ]}
              />
            </View>
            <ThemedText
              type="small"
              style={[styles.progressText, { color: cp.textMuted }]}
            >
              {Math.round(ringProgress * 100)}%
            </ThemedText>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={handlePauseResume}
            style={[styles.mainButton, { shadowColor: cp.neonGreen }]}
          >
            <LinearGradient
              colors={[cp.neonGreen, isDarkMode ? "#00CC66" : "#00994D"]}
              style={styles.mainButtonGradient}
            >
              <Feather
                name={workoutState?.isPaused ? "play" : "pause"}
                size={32}
                color="#000"
              />
            </LinearGradient>
          </Pressable>

          <View style={styles.secondaryControls}>
            <Pressable
              onPress={handleSkip}
              style={[
                styles.secondaryButton,
                { backgroundColor: cp.cardBorder, borderColor: cp.cardBorder },
              ]}
            >
              <Feather name="skip-forward" size={20} color={cp.text} />
              <ThemedText
                type="small"
                style={{ marginLeft: Spacing.xs, color: cp.text }}
              >
                Skip
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleEnd}>
              <ThemedText type="small" style={{ color: cp.textMuted }}>
                End Workout
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>

      <FormTipsSheet visible={showTips} onClose={() => setShowTips(false)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  exerciseDescription: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.xs,
    fontStyle: "italic",
  },
  powerBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
    gap: Spacing["3xl"],
  },
  circularContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  ringCountdownContainer: {
    alignItems: "center",
  },
  ringCountdown: {
    fontSize: 56,
    fontWeight: "200",
    letterSpacing: -2,
  },
  ringCountdownLabel: {
    marginTop: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 11,
  },
  countdownContainer: {
    alignItems: "center",
    width: 120,
  },
  countdown: {
    fontSize: 72,
    fontWeight: "200",
    letterSpacing: -2,
  },
  countdownLabel: {
    marginTop: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  segmentInfo: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  segmentName: {
    marginBottom: Spacing.xs,
  },
  segmentDetail: {
    textAlign: "center",
  },
  progressBarContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    width: 40,
    textAlign: "right",
  },
  controls: {
    alignItems: "center",
    paddingTop: Spacing.xl,
  },
  mainButton: {
    marginBottom: Spacing.xl,
    borderRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  mainButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing["2xl"],
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  completeContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  completeIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["3xl"],
  },
  completeTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  completeSubtitle: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  completeStats: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  completeStat: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
  },
  doneButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
