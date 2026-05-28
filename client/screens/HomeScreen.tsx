import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  RefreshControl,
  ScrollView,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { Toggle } from "@/components/Toggle";
import { WeeklyReviewModal } from "@/components/WeeklyReviewModal";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_CONTENT,
  ANIM_DELAY_SHORT,
  ANIM_DELAY_MED,
  ANIM_DELAY_LONG,
  ANIM_DELAY_XL,
} from "@/constants/animation";
import {
  storage,
  UserSettings,
  UserProgress,
  defaultSettings,
  ControlScoreState,
} from "@/lib/storage";
import {
  RankName,
  getTrend,
  todayDateString,
  getRankBandProgress,
  getPointsToNextRank,
  getNextRank,
} from "@/lib/controlScore";
import { RankUpToast } from "@/components/RankUpToast";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import {
  getTodaysWorkout,
  getWorkoutForRecoveryMode,
  getScheduledDaysForWeek,
  getWorkoutCompletionsForWeek,
  getWeek1WorkoutForDayIndex,
  getWorkoutForDifficultyPath,
  DayTemplate,
  Week,
} from "@/data/workoutProgram";
import { trackWeekComplete } from "@/lib/analytics";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  type UserProgramProgress,
  CONTROL_MODE_LABEL,
  CONTROL_MODE_TAGLINE,
  CONTROL_MODE_WEEKLY_TARGET,
  getControlModeTodaysWorkout,
  getControlModeWeeklyCount,
} from "@/lib/programCompletion";
import {
  getExerciseTypesIn,
  SEGMENT_TYPE_LABEL,
} from "@/data/controlModeWorkouts";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { fontScale, colors, highContrast } = useAccessibility();
  const { hasAccess } = useSubscription();
  const { cp, isDarkMode } = useThemePreference();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [todaysWorkout, setTodaysWorkout] = useState<{
    week: Week;
    dayIndex: number;
    workout: DayTemplate;
    isRestDay: boolean;
  } | null>(null);
  const [isTodayComplete, setIsTodayComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [weeklyReviewData, setWeeklyReviewData] = useState<{
    weekNumber: number;
    daysWorkedOut: number;
  } | null>(null);
  const [pendingReviewMessage, setPendingReviewMessage] = useState<string>("");
  const trackedWeekCompleteRef = useRef<number | null>(null);
  const [calibrationCompleted, setCalibrationCompleted] = useState(true);
  const [difficultyPath, setDifficultyPath] = useState<
    "accelerated" | "standard" | "gentle" | null
  >(null);
  const [showCalibrationIntro, setShowCalibrationIntro] = useState(false);
  const [scoreState, setScoreState] = useState<ControlScoreState | null>(null);
  const [backOnTrack, setBackOnTrack] = useState(false);
  const [pendingRankUp, setPendingRankUp] = useState<RankName | null>(null);
  const [programProgress, setProgramProgress] =
    useState<UserProgramProgress | null>(null);
  const [controlModeWeekCount, setControlModeWeekCount] = useState(0);

  const loadData = useCallback(async () => {
    const startDate = await storage.getProgramStartDate();

    await storage.backfillRestDays(startDate);
    const freshScore = await storage.applyDailyDecay();
    setScoreState(freshScore);
    const isBackOnTrack = await storage.consumeBackOnTrackPending();
    if (isBackOnTrack) {
      setBackOnTrack(true);
      setTimeout(() => setBackOnTrack(false), 6000);
    }
    const pendingRank = await storage.consumePendingRankUp();
    if (pendingRank) setPendingRankUp(pendingRank);

    const [userProgress, userSettings, calibState, progProgress] =
      await Promise.all([
        storage.getProgress(),
        storage.getSettings(),
        storage.getCalibrationState(),
        storage.getProgramProgress(),
      ]);

    setProgress(userProgress);
    setSettings(userSettings);
    setCalibrationCompleted(calibState.calibrationCompleted);
    setDifficultyPath(calibState.difficultyPath);
    setProgramProgress(progProgress);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setIsTodayComplete(userProgress.completedDates.includes(todayStr));

    // Detect 12-week program completion → navigate to ProgramComplete.
    // Skipped if user is in 7-day challenge phase or already in control mode
    // or has already made a decision.
    const shouldShowComplete =
      await storage.shouldShowProgramCompletion(todayStr);
    if (shouldShowComplete) {
      await storage.evaluateAndStoreCompletionTier();
      navigation.navigate("ProgramComplete");
      return;
    }

    // Control Mode: override today's workout with path-specific cycle and
    // compute weekly session count for banner.
    if (
      progProgress.phase === "control_mode" &&
      progProgress.controlModePath &&
      progProgress.controlModeStartDate
    ) {
      const recentSegmentTypeCounts =
        await storage.getRecentSegmentTypeCounts(todayStr);
      const restDates = await storage.getRestDates();
      // Exclude explicitly-rested dates so habit inference reflects
      // actual workout-completion behavior only.
      const restSet = new Set(restDates);
      const habitCompletions = userProgress.completedDates.filter(
        (d) => !restSet.has(d),
      );
      const controlWorkout = getControlModeTodaysWorkout(
        progProgress.controlModePath,
        progProgress.controlModeStartDate,
        todayStr,
        {
          rank: freshScore?.currentRank,
          recentCompletions: habitCompletions,
          recentSegmentTypeCounts,
          pinnedRestWeekdays: progProgress.controlModePinnedRestWeekdays ?? [],
        },
      );
      setTodaysWorkout(controlWorkout);
      setControlModeWeekCount(
        getControlModeWeeklyCount(
          userProgress.completedDates,
          restDates,
          todayStr,
        ),
      );
      return;
    }

    const workout = getTodaysWorkout(
      userProgress.completedDates,
      startDate || undefined,
    );

    if (workout && workout.week.weekNumber === 1) {
      const adjustedWorkout = getWeek1WorkoutForDayIndex(
        workout.dayIndex,
        calibState.difficultyPath,
      );
      setTodaysWorkout({
        ...workout,
        workout: adjustedWorkout,
        isRestDay: adjustedWorkout.isRestDay === true,
      });
    } else if (workout && workout.week.weekNumber >= 2) {
      const weekPath = await storage.getDifficultyPathForWeek(
        workout.week.weekNumber,
      );
      const adjustedWorkout = getWorkoutForDifficultyPath(
        workout.workout,
        weekPath,
      );
      setTodaysWorkout({
        ...workout,
        workout: adjustedWorkout,
      });
      setDifficultyPath(weekPath);
    } else {
      setTodaysWorkout(workout);
    }

    const reviewCheck = await storage.shouldShowWeeklyReview(
      userProgress.completedDates,
      startDate,
    );
    if (reviewCheck.show) {
      const scheduledDays = getScheduledDaysForWeek(reviewCheck.weekNumber);
      const workoutCompletions = startDate
        ? getWorkoutCompletionsForWeek(
            userProgress.completedDates,
            reviewCheck.weekNumber,
            startDate,
          )
        : 0;

      setWeeklyReviewData({
        weekNumber: reviewCheck.weekNumber,
        daysWorkedOut: reviewCheck.daysWorkedOut,
      });
      setShowWeeklyReview(true);

      if (
        scheduledDays > 0 &&
        workoutCompletions >= scheduledDays &&
        trackedWeekCompleteRef.current !== reviewCheck.weekNumber
      ) {
        const lastTracked = await storage.getLastWeekCompleteTracked();
        if (lastTracked !== reviewCheck.weekNumber) {
          trackedWeekCompleteRef.current = reviewCheck.weekNumber;
          await storage.setLastWeekCompleteTracked(reviewCheck.weekNumber);
          trackWeekComplete({
            weekNumber: reviewCheck.weekNumber,
            daysWorkedOut: workoutCompletions,
            scheduledDays,
          });
        } else {
          trackedWeekCompleteRef.current = reviewCheck.weekNumber;
        }
      }
    }
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleRecoveryModeChange = async (value: boolean) => {
    await storage.saveSettings({ recoveryMode: value });
    setSettings((prev) => ({ ...prev, recoveryMode: value }));
  };

  const navigateToTrialExpired = async () => {
    try {
      const seen = await AsyncStorage.getItem("pulsekegel_challenge_shown");
      if (!seen) {
        await AsyncStorage.setItem("pulsekegel_challenge_shown", "true");
        navigation.navigate("Week1Review");
      } else {
        navigation.navigate("Paywall");
      }
    } catch {
      navigation.navigate("Paywall");
    }
  };

  const isDay1Calibration =
    todaysWorkout?.week.weekNumber === 1 && todaysWorkout?.dayIndex === 0;

  const pathMeta = (() => {
    if (!difficultyPath) return null;
    if (difficultyPath === "accelerated")
      return { label: "Accelerated Path", color: cp.neonCyan };
    if (difficultyPath === "gentle")
      return { label: "Gentle Path", color: cp.neonPurple };
    return { label: "Standard Path", color: cp.neonGreen };
  })();

  const renderPathBadge = () => {
    if (!pathMeta) return null;
    return (
      <View
        style={[
          styles.pathBadge,
          {
            backgroundColor: `${pathMeta.color}1A`,
            borderColor: `${pathMeta.color}4D`,
          },
        ]}
      >
        <Feather name="trending-up" size={11} color={pathMeta.color} />
        <Text
          style={[
            styles.pathBadgeText,
            { color: pathMeta.color, fontSize: 11 * fontScale },
          ]}
          testID="badge-training-path"
        >
          {pathMeta.label}
        </Text>
      </View>
    );
  };

  const startWorkoutNavigation = () => {
    if (!todaysWorkout) return;
    const workout = settings.recoveryMode
      ? getWorkoutForRecoveryMode(todaysWorkout.workout)
      : todaysWorkout.workout;
    navigation.navigate("WorkoutPlayer", {
      workout,
      weekNumber: todaysWorkout.week.weekNumber,
      phase: todaysWorkout.week.phase,
      dayNumber: todaysWorkout.dayIndex + 1,
    });
  };

  const handleStartWorkout = async () => {
    if (!todaysWorkout) return;

    if (!hasAccess) {
      await navigateToTrialExpired();
      return;
    }

    if (isDay1Calibration && !calibrationCompleted && !isTodayComplete) {
      setShowCalibrationIntro(true);
      return;
    }

    startWorkoutNavigation();
  };

  const handleQuickWorkout = async () => {
    if (!hasAccess) {
      await navigateToTrialExpired();
      return;
    }
    navigation.navigate("WorkoutPicker");
  };

  const handleRedoWorkout = async () => {
    await storage.uncompleteToday();
    setIsTodayComplete(false);
  };

  const handleWeeklyReviewClose = async () => {
    if (weeklyReviewData && pendingReviewMessage) {
      await storage.saveWeeklyReviewToHistory({
        weekNumber: weeklyReviewData.weekNumber,
        daysWorkedOut: weeklyReviewData.daysWorkedOut,
        totalMinutes: progress?.totalMinutes || 0,
        message: pendingReviewMessage,
        date: new Date().toISOString().split("T")[0],
      });
      await storage.setLastWeeklyReview(weeklyReviewData.weekNumber);
    }
    setShowWeeklyReview(false);
    setWeeklyReviewData(null);
    setPendingReviewMessage("");
  };

  const formatLastCompleted = (dateStr: string | null): string => {
    if (!dateStr) return "Never";

    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (dateStr === formatLocalDate(today)) {
      return "Today";
    } else if (dateStr === formatLocalDate(yesterday)) {
      return "Yesterday";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const heroTrend = scoreState
    ? getTrend(
        scoreState.scoreHistory,
        scoreState.controlScore,
        todayDateString(),
      )
    : ("holding" as const);
  const heroTrendColor =
    heroTrend === "gaining"
      ? cp.neonGreen
      : heroTrend === "slipping"
        ? cp.neonOrange
        : cp.text;
  const heroTrendIcon =
    heroTrend === "gaining"
      ? ("trending-up" as const)
      : heroTrend === "slipping"
        ? ("trending-down" as const)
        : ("minus" as const);
  const heroTrendLabel =
    heroTrend === "gaining"
      ? "Gaining"
      : heroTrend === "slipping"
        ? "Slipping"
        : "Holding";
  const heroRankProgress = scoreState
    ? getRankBandProgress(scoreState.controlScore)
    : 0;
  const heroPointsToNext = scoreState
    ? getPointsToNextRank(scoreState.controlScore)
    : 0;
  const heroNextRank = scoreState ? getNextRank(scoreState.currentRank) : null;

  return (
    <LinearGradient
      colors={cp.gradient as unknown as [string, string, ...string[]]}
      style={styles.gradientContainer}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={cp.neonGreen}
          />
        }
      >
        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_SHORT,
          )}
        >
          <View style={styles.heroRow}>
            <View
              style={[
                styles.streakBadge,
                {
                  backgroundColor: `${cp.neonGreen}1A`,
                  borderColor: `${cp.neonGreen}4D`,
                },
                highContrast && { borderColor: colors.border },
              ]}
            >
              <Feather name="zap" size={18 * fontScale} color={colors.accent} />
              <Text
                style={[
                  styles.streakNumber,
                  {
                    fontSize: 36 * fontScale,
                    color: cp.neonGreen,
                    textShadowColor: isDarkMode ? cp.neonGreen : "transparent",
                  },
                ]}
              >
                {progress?.currentStreak || 0}
              </Text>
              <Text
                style={[
                  styles.streakLabel,
                  { fontSize: 11 * fontScale, color: cp.textSecondary },
                ]}
              >
                Day Streak
              </Text>
            </View>
            {scoreState ? (
              <View
                style={[
                  styles.rankPanel,
                  {
                    backgroundColor: `${cp.neonCyan}1A`,
                    borderColor: `${cp.neonCyan}4D`,
                  },
                ]}
              >
                <View style={styles.rankPanelTopRow}>
                  <View>
                    <Text
                      style={[
                        styles.rankPanelLabel,
                        { color: cp.textMuted, fontSize: 10 * fontScale },
                      ]}
                    >
                      RANK
                    </Text>
                    <Text
                      style={[
                        styles.rankPanelName,
                        {
                          color: cp.neonCyan,
                          fontSize: 20 * fontScale,
                          textShadowColor: isDarkMode
                            ? cp.neonCyan
                            : "transparent",
                        },
                      ]}
                    >
                      {scoreState.currentRank}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.rankTrendChip,
                      {
                        backgroundColor: `${heroTrendColor}1A`,
                        borderColor: `${heroTrendColor}55`,
                      },
                    ]}
                  >
                    <Feather
                      name={heroTrendIcon}
                      size={11}
                      color={heroTrendColor}
                    />
                    <Text
                      style={[
                        styles.rankTrendText,
                        { color: heroTrendColor, fontSize: 10 * fontScale },
                      ]}
                    >
                      {heroTrendLabel}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.rankScoreDivider,
                    { backgroundColor: `${cp.neonCyan}33` },
                  ]}
                />

                <Text
                  style={[
                    styles.rankPanelLabel,
                    { color: cp.textMuted, fontSize: 10 * fontScale },
                  ]}
                >
                  CONTROL SCORE
                </Text>
                <View style={styles.rankScoreRow}>
                  <Text
                    style={[
                      styles.rankScoreValue,
                      { color: cp.text, fontSize: 22 * fontScale },
                    ]}
                    testID="text-control-score"
                  >
                    {scoreState.controlScore}
                  </Text>
                  <Text
                    style={[
                      styles.rankScoreMax,
                      { color: cp.textMuted, fontSize: 12 * fontScale },
                    ]}
                  >
                    / 1000
                  </Text>
                </View>
                <View
                  style={[
                    styles.rankProgressTrack,
                    { backgroundColor: cp.divider },
                  ]}
                >
                  <View
                    style={[
                      styles.rankProgressFill,
                      {
                        width: `${Math.max(2, heroRankProgress * 100)}%`,
                        backgroundColor: cp.neonGreen,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.rankNextText,
                    { color: cp.textSecondary, fontSize: 10 * fontScale },
                  ]}
                >
                  {heroNextRank
                    ? `${heroPointsToNext} ${heroPointsToNext === 1 ? "pt" : "pts"} to ${heroNextRank.name}`
                    : "Elite reached — keep your edge."}
                </Text>
                {backOnTrack ? (
                  <Animated.View
                    entering={FadeInDown.duration(400)}
                    exiting={FadeOut.duration(500)}
                    style={[
                      styles.rankNudge,
                      {
                        backgroundColor: `${cp.neonGreen}1A`,
                        borderColor: `${cp.neonGreen}55`,
                      },
                    ]}
                    testID="nudge-back-on-track"
                  >
                    <Feather
                      name="check-circle"
                      size={10}
                      color={cp.neonGreen}
                    />
                    <Text
                      style={[
                        styles.rankNudgeText,
                        { color: cp.neonGreen, fontSize: 10 * fontScale },
                      ]}
                    >
                      Back on track. Decay paused.
                    </Text>
                  </Animated.View>
                ) : scoreState.idleDays >= 2 ? (
                  <Animated.View
                    entering={FadeInDown.duration(400)}
                    exiting={FadeOut.duration(500)}
                    style={[
                      styles.rankNudge,
                      {
                        backgroundColor: `${cp.neonOrange}1A`,
                        borderColor: `${cp.neonOrange}55`,
                      },
                    ]}
                    testID="nudge-score-slipping"
                  >
                    <Feather
                      name="alert-circle"
                      size={10}
                      color={cp.neonOrange}
                    />
                    <Text
                      style={[
                        styles.rankNudgeText,
                        { color: cp.neonOrange, fontSize: 10 * fontScale },
                      ]}
                    >
                      {scoreState.idleDays}{" "}
                      {scoreState.idleDays === 1 ? "day" : "days"} idle — log a
                      session to stop decay
                    </Text>
                  </Animated.View>
                ) : null}
              </View>
            ) : null}
          </View>
        </Animated.View>

        {programProgress?.phase === "control_mode" &&
        programProgress.controlModePath ? (
          <Animated.View
            entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
              ANIM_DELAY_SHORT,
            )}
          >
            <View
              style={[
                styles.scoreNudge,
                {
                  backgroundColor: `${cp.neonCyan}1A`,
                  borderColor: `${cp.neonCyan}4D`,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                },
              ]}
              testID="banner-control-mode"
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Feather name="shield" size={16} color={cp.neonCyan} />
                <Text
                  style={[styles.scoreNudgeText, { color: cp.text, flex: 0 }]}
                  testID="text-control-mode-summary"
                >
                  Control Mode ·{" "}
                  {CONTROL_MODE_LABEL[programProgress.controlModePath]} ·{" "}
                  {controlModeWeekCount} of{" "}
                  {CONTROL_MODE_WEEKLY_TARGET[programProgress.controlModePath]}{" "}
                  this week
                </Text>
              </View>
              {todaysWorkout ? (
                <>
                  <Text
                    style={[
                      styles.scoreNudgeText,
                      { color: cp.text, fontSize: 13, fontWeight: "600" },
                    ]}
                    testID="text-control-mode-today"
                  >
                    Today:{" "}
                    {todaysWorkout.isRestDay
                      ? "Rest Day"
                      : `${todaysWorkout.workout.name} · ${todaysWorkout.workout.estimatedMinutes} min`}
                  </Text>
                  {!todaysWorkout.isRestDay &&
                  getExerciseTypesIn(todaysWorkout.workout).length > 0 ? (
                    <Text
                      style={[
                        styles.scoreNudgeText,
                        { color: cp.textSecondary, fontSize: 12 },
                      ]}
                      testID="text-control-mode-today-segments"
                    >
                      Focus:{" "}
                      {getExerciseTypesIn(todaysWorkout.workout)
                        .map((t) => SEGMENT_TYPE_LABEL[t] ?? t)
                        .join(" + ")}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Text
                style={[
                  styles.scoreNudgeText,
                  { color: cp.textSecondary, fontSize: 12 },
                ]}
              >
                {CONTROL_MODE_TAGLINE[programProgress.controlModePath]}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_MED,
          )}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: cp.cardBg,
                borderColor:
                  isTodayComplete && !todaysWorkout?.isRestDay
                    ? `${cp.neonGreen}4D`
                    : cp.cardBorder,
              },
            ]}
          >
            {todaysWorkout ? (
              todaysWorkout.isRestDay ? (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text
                        style={[
                          styles.phaseLabel,
                          {
                            fontSize: 14 * fontScale,
                            color: colors.accentSecondary,
                            textShadowColor: isDarkMode
                              ? cp.neonCyan
                              : "transparent",
                          },
                        ]}
                      >
                        {todaysWorkout.week.weekNumber > 0
                          ? `Week ${todaysWorkout.week.weekNumber} - ${todaysWorkout.week.phase}`
                          : todaysWorkout.week.phaseDescription}
                      </Text>
                      <Text
                        style={[
                          styles.workoutTitle,
                          { fontSize: 24 * fontScale, color: cp.text },
                        ]}
                      >
                        Rest Day
                      </Text>
                      {renderPathBadge()}
                    </View>
                    <View
                      style={[
                        styles.durationBadge,
                        { backgroundColor: "rgba(139, 92, 246, 0.2)" },
                      ]}
                    >
                      <Feather name="moon" size={14} color={cp.neonPurple} />
                      <Text
                        style={[styles.durationText, { color: cp.neonPurple }]}
                      >
                        Recovery
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.phaseDescription,
                      { color: cp.textSecondary },
                    ]}
                  >
                    Take today to recover. Your muscles grow stronger during
                    rest!
                  </Text>

                  <View
                    style={[
                      styles.streakProtectedBadge,
                      {
                        backgroundColor: `${cp.neonGreen}18`,
                        borderColor: `${cp.neonGreen}40`,
                      },
                    ]}
                  >
                    <Feather
                      name="shield"
                      size={16}
                      color={cp.neonGreen}
                    />
                    <Text
                      style={[
                        styles.streakProtectedText,
                        { color: cp.neonGreen },
                      ]}
                    >
                      Streak protected — rest day logged
                    </Text>
                  </View>

                  <View style={styles.restDayContent}>
                    <View style={styles.restDayIcon}>
                      <Feather
                        name="battery-charging"
                        size={32}
                        color={cp.neonPurple}
                      />
                    </View>
                    <Text
                      style={[
                        styles.restDayMessage,
                        { color: cp.textSecondary },
                      ]}
                    >
                      Rest days are essential for muscle recovery and preventing
                      overtraining. Your pelvic floor is building strength from
                      your previous workouts.
                    </Text>
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable
                      onPress={() =>
                        navigation.navigate("BreathworkModeSelector")
                      }
                      style={styles.startButtonContainer}
                      testID="breathwork-button"
                    >
                      <LinearGradient
                        colors={["#00B4C5", "#0090A0"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Feather
                          name="wind"
                          size={18}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.startButtonText,
                            { fontSize: 16 * fontScale },
                          ]}
                        >
                          Breathwork Session
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable
                      onPress={handleQuickWorkout}
                      style={styles.startButtonContainer}
                    >
                      <LinearGradient
                        colors={[cp.neonPurple, cp.neonPink]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Text
                          style={[
                            styles.startButtonText,
                            { fontSize: 16 * fontScale },
                          ]}
                        >
                          Optional Quick Workout
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              ) : isTodayComplete ? (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text
                        style={[
                          styles.phaseLabel,
                          {
                            fontSize: 14 * fontScale,
                            color: colors.accentSecondary,
                            textShadowColor: isDarkMode
                              ? cp.neonCyan
                              : "transparent",
                          },
                        ]}
                      >
                        {todaysWorkout.week.weekNumber > 0
                          ? `Week ${todaysWorkout.week.weekNumber} - ${todaysWorkout.week.phase}`
                          : todaysWorkout.week.phaseDescription}
                      </Text>
                      <Text
                        style={[
                          styles.workoutTitle,
                          { fontSize: 24 * fontScale, color: cp.text },
                        ]}
                      >
                        {todaysWorkout.workout.name}
                      </Text>
                      {renderPathBadge()}
                    </View>
                    <View
                      style={[
                        styles.durationBadge,
                        {
                          backgroundColor: `${cp.neonGreen}26`,
                          borderColor: `${cp.neonGreen}4D`,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Feather
                        name="check-circle"
                        size={14}
                        color={cp.neonGreen}
                      />
                      <Text
                        style={[styles.durationText, { color: cp.neonGreen }]}
                      >
                        Complete
                      </Text>
                    </View>
                  </View>

                  <View style={styles.completionPanel}>
                    <View
                      style={[
                        styles.completionIconCircle,
                        {
                          backgroundColor: `${cp.neonGreen}1A`,
                          borderColor: `${cp.neonGreen}33`,
                        },
                      ]}
                    >
                      <Feather name="check" size={36} color={cp.neonGreen} />
                    </View>
                    <Text
                      style={[
                        styles.completionHeading,
                        {
                          fontSize: 22 * fontScale,
                          color: cp.neonGreen,
                          textShadowColor: isDarkMode
                            ? cp.neonGreen
                            : "transparent",
                        },
                      ]}
                    >
                      {"Today's Complete!"}
                    </Text>
                    <Text
                      style={[
                        styles.completionSubtext,
                        { color: cp.textSecondary },
                      ]}
                    >
                      Great work. Your pelvic floor is getting stronger every
                      session.
                    </Text>
                  </View>

                  <View style={styles.completionActions}>
                    <Pressable
                      onPress={handleQuickWorkout}
                      style={[
                        styles.secondaryActionButton,
                        {
                          backgroundColor: `${cp.neonCyan}1A`,
                          borderColor: `${cp.neonCyan}4D`,
                        },
                      ]}
                    >
                      <Feather name="zap" size={16} color={cp.neonCyan} />
                      <Text
                        style={[
                          styles.secondaryActionText,
                          { color: cp.neonCyan },
                        ]}
                      >
                        Quick Workout
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        navigation.navigate("BreathworkModeSelector")
                      }
                      style={[
                        styles.secondaryActionButton,
                        {
                          backgroundColor: "rgba(0,180,197,0.1)",
                          borderColor: "rgba(0,180,197,0.3)",
                        },
                      ]}
                      testID="breathwork-button"
                    >
                      <Feather name="wind" size={16} color="#00B4C5" />
                      <Text
                        style={[
                          styles.secondaryActionText,
                          { color: "#00B4C5" },
                        ]}
                      >
                        Breathwork
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={handleRedoWorkout}
                    testID="button-redo-workout"
                    style={[
                      styles.redoWorkoutButton,
                      { borderColor: cp.cardBorder },
                    ]}
                  >
                    <Feather name="refresh-cw" size={14} color={cp.textMuted} />
                    <Text
                      style={[styles.redoWorkoutText, { color: cp.textMuted }]}
                    >
                      {"Redo Today's Workout"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text
                        style={[
                          styles.phaseLabel,
                          {
                            fontSize: 14 * fontScale,
                            color: colors.accentSecondary,
                            textShadowColor: isDarkMode
                              ? cp.neonCyan
                              : "transparent",
                          },
                        ]}
                      >
                        {todaysWorkout.week.weekNumber > 0
                          ? `Week ${todaysWorkout.week.weekNumber} - ${todaysWorkout.week.phase}`
                          : todaysWorkout.week.phaseDescription}
                      </Text>
                      <Text
                        style={[
                          styles.workoutTitle,
                          { fontSize: 24 * fontScale, color: cp.text },
                        ]}
                      >
                        {todaysWorkout.workout.name}
                      </Text>
                      {renderPathBadge()}
                    </View>
                    <View
                      style={[
                        styles.durationBadge,
                        { backgroundColor: cp.cardBorder },
                      ]}
                    >
                      <Feather
                        name="clock"
                        size={14}
                        color={cp.textSecondary}
                      />
                      <Text
                        style={[
                          styles.durationText,
                          { color: cp.textSecondary },
                        ]}
                      >
                        {settings.recoveryMode
                          ? getWorkoutForRecoveryMode(todaysWorkout.workout)
                              .estimatedMinutes
                          : todaysWorkout.workout.estimatedMinutes}{" "}
                        min
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.phaseDescription,
                      { color: cp.textSecondary },
                    ]}
                  >
                    {todaysWorkout.week.phaseDescription}
                  </Text>

                  <View style={styles.segmentsList}>
                    {(settings.recoveryMode
                      ? getWorkoutForRecoveryMode(todaysWorkout.workout)
                      : todaysWorkout.workout
                    ).segments.map((segment) => (
                      <View key={segment.id} style={styles.segmentItem}>
                        <View
                          style={[
                            styles.segmentDot,
                            { backgroundColor: cp.neonGreen },
                          ]}
                        />
                        <Text
                          style={[
                            styles.segmentText,
                            { color: cp.textSecondary },
                          ]}
                        >
                          {segment.name} ({segment.sets}x{segment.repsPerSet})
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable
                      onPress={handleStartWorkout}
                      style={[
                        styles.startButtonContainer,
                        {
                          shadowColor: isDarkMode
                            ? cp.neonGreen
                            : "transparent",
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={[cp.neonGreen, cp.neonCyan]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Text
                          style={[
                            styles.startButtonText,
                            { fontSize: 16 * fontScale },
                          ]}
                        >
                          Start Program
                        </Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onPress={handleQuickWorkout}
                      style={[
                        styles.quickWorkoutButton,
                        {
                          backgroundColor: `${cp.neonCyan}1A`,
                          borderColor: `${cp.neonCyan}4D`,
                        },
                      ]}
                    >
                      <Feather name="zap" size={18} color={cp.neonCyan} />
                      <Text
                        style={[
                          styles.quickWorkoutText,
                          { color: cp.neonCyan },
                        ]}
                      >
                        Quick
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() =>
                      navigation.navigate("BreathworkModeSelector")
                    }
                    style={styles.breathworkLink}
                    testID="breathwork-button"
                  >
                    <Feather name="wind" size={16} color="#00B4C5" />
                    <Text
                      style={[styles.breathworkLinkText, { color: "#00B4C5" }]}
                    >
                      Breathwork Session
                    </Text>
                    <Feather name="chevron-right" size={16} color="#00B4C5" />
                  </Pressable>
                </>
              )
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: cp.textSecondary }]}>
                  Loading workout...
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_LONG,
          )}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <View style={styles.recoveryHeader}>
              <View style={styles.recoveryInfo}>
                <View
                  style={[
                    styles.recoveryIcon,
                    { backgroundColor: `${cp.neonPurple}26` },
                  ]}
                >
                  <Feather name="heart" size={20} color={cp.neonPurple} />
                </View>
                <View style={styles.recoveryText}>
                  <Text style={[styles.recoveryTitle, { color: cp.text }]}>
                    Recovery Mode
                  </Text>
                  <Text
                    style={[
                      styles.recoverySubtitle,
                      { color: cp.textSecondary },
                    ]}
                  >
                    Reduced intensity with relaxation
                  </Text>
                </View>
              </View>
              <Toggle
                value={settings.recoveryMode}
                onValueChange={handleRecoveryModeChange}
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_XL,
          )}
        >
          <View style={styles.statsRow}>
            <View
              style={[
                styles.statItem,
                { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
              ]}
            >
              <Feather name="check-circle" size={18} color={cp.neonGreen} />
              <Text style={[styles.statValue, { color: cp.text }]}>
                {progress?.totalSessions || 0}
              </Text>
              <Text style={[styles.statLabel, { color: cp.textSecondary }]}>
                Sessions
              </Text>
            </View>

            <View
              style={[
                styles.statItem,
                { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
              ]}
            >
              <Feather name="clock" size={18} color={cp.neonCyan} />
              <Text style={[styles.statValue, { color: cp.text }]}>
                {progress?.totalMinutes || 0}
              </Text>
              <Text style={[styles.statLabel, { color: cp.textSecondary }]}>
                Minutes
              </Text>
            </View>

            <View
              style={[
                styles.statItem,
                { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
              ]}
            >
              <Feather name="calendar" size={18} color={cp.neonCyan} />
              <Text style={[styles.statValue, { color: cp.text }]}>
                {formatLastCompleted(progress?.lastCompletedDate || null)}
              </Text>
              <Text style={[styles.statLabel, { color: cp.textSecondary }]}>
                Last Done
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <WeeklyReviewModal
        visible={showWeeklyReview}
        onClose={handleWeeklyReviewClose}
        weekNumber={weeklyReviewData?.weekNumber || 1}
        daysWorkedOut={weeklyReviewData?.daysWorkedOut || 0}
        totalMinutes={progress?.totalMinutes || 0}
        anatomyType={settings.anatomyType}
        userName={settings.userName}
        currentStreak={progress?.currentStreak ?? 0}
        onMessageReady={setPendingReviewMessage}
      />

      <Modal
        visible={showCalibrationIntro}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.introOverlay}>
          <View
            style={[
              styles.introSheet,
              {
                backgroundColor: isDarkMode
                  ? "rgba(16, 16, 36, 0.97)"
                  : "rgba(255,255,255,0.97)",
                borderColor: `${cp.neonGreen}30`,
              },
            ]}
          >
            <View
              style={[
                styles.introIconWrap,
                {
                  backgroundColor: `${cp.neonGreen}20`,
                  borderColor: `${cp.neonGreen}40`,
                },
              ]}
            >
              <Feather name="crosshair" size={32} color={cp.neonGreen} />
            </View>
            <Text
              style={[
                styles.introEyebrow,
                { color: cp.neonGreen, fontSize: 11 * fontScale },
              ]}
            >
              CALIBRATION DAY
            </Text>
            <Text
              style={[
                styles.introTitle,
                { color: cp.text, fontSize: 22 * fontScale },
              ]}
            >
              {"Let's see where you're starting from"}
            </Text>
            <Text
              style={[
                styles.introBody,
                { color: cp.textSecondary, fontSize: 15 * fontScale },
              ]}
            >
              {
                "Welcome to Week 1, Day 1 — Calibration day! We're going to start nice and easy to see where your body is at. Let's go!"
              }
            </Text>
            <Pressable
              onPress={() => {
                setShowCalibrationIntro(false);
                startWorkoutNavigation();
              }}
              testID="button-calibration-intro-start"
              style={[styles.introButton, { backgroundColor: cp.neonGreen }]}
            >
              <Feather name="play" size={18} color={cp.bg} />
              <Text
                style={[
                  styles.introButtonText,
                  { color: cp.bg, fontSize: 16 * fontScale },
                ]}
              >
                Start calibration
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowCalibrationIntro(false)}
              testID="button-calibration-intro-cancel"
              style={styles.introCancelButton}
            >
              <Text
                style={[
                  styles.introCancelText,
                  { color: cp.textMuted, fontSize: 14 * fontScale },
                ]}
              >
                Not yet
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <RankUpToast
        rank={pendingRankUp}
        onDismiss={async () => {
          if (pendingRankUp) {
            await storage.markRankNotified(pendingRankUp);
          }
          setPendingRankUp(null);
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  heroRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  scoreNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  scoreNudgeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  streakBadge: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  rankPanel: {
    flex: 3,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  rankPanelTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
  },
  rankPanelLabel: {
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  rankPanelName: {
    fontWeight: "700",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  rankTrendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  rankTrendText: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  rankScoreDivider: {
    height: 1,
    width: "100%",
    marginVertical: Spacing.xs,
  },
  rankScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  rankScoreValue: {
    fontWeight: "700",
  },
  rankScoreMax: {
    fontWeight: "500",
  },
  rankProgressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    width: "100%",
  },
  rankProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  rankNextText: {
    marginTop: 2,
  },
  rankNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  rankNudgeText: {
    fontWeight: "500",
    flexShrink: 1,
  },
  streakNumber: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "700",
    marginTop: Spacing.sm,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  streakLabel: {
    marginTop: Spacing.xs,
    fontSize: 14,
  },
  card: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  phaseLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    fontSize: 14,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  workoutTitle: {
    marginBottom: Spacing.xs,
    fontSize: 24,
    fontWeight: "600",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  durationText: {
    marginLeft: Spacing.xs,
    fontSize: 14,
  },
  pathBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  pathBadgeText: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  phaseDescription: {
    marginBottom: Spacing.lg,
    fontSize: 14,
  },
  restDayContent: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  restDayIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  restDayMessage: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  segmentsList: {
    marginBottom: Spacing.lg,
  },
  segmentItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  segmentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.sm,
  },
  segmentText: {
    fontSize: 14,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  startButtonContainer: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  startButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
  },
  startButtonText: {
    color: "#0a0a1a",
    fontSize: 16,
    fontWeight: "700",
  },
  quickWorkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  quickWorkoutText: {
    fontSize: 14,
    fontWeight: "600",
  },
  breathworkLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  breathworkLinkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  recoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recoveryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  recoveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  recoveryText: {
    flex: 1,
  },
  recoveryTitle: {
    fontWeight: "600",
    fontSize: 16,
  },
  recoverySubtitle: {
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statValue: {
    fontWeight: "600",
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    fontSize: 16,
  },
  statLabel: {
    fontSize: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  completionPanel: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  completionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  completionHeading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  completionSubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  completionActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  streakProtectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  streakProtectedText: {
    fontSize: 14,
    fontWeight: "600",
  },
  redoWorkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  redoWorkoutText: {
    fontSize: 13,
  },
  introOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  introSheet: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  introIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  introEyebrow: {
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
  },
  introTitle: {
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 30,
  },
  introBody: {
    textAlign: "center",
    lineHeight: 23,
    marginTop: Spacing.xs,
  },
  introButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    width: "100%",
    marginTop: Spacing.md,
  },
  introButtonText: {
    fontWeight: "700",
  },
  introCancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  introCancelText: {
    fontWeight: "500",
  },
});
