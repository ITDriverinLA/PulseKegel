import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  workoutProgram,
  Week,
  DayTemplate,
  ChallengeDifficultyPath,
  getWeek1WorkoutForDayIndex,
  getWorkoutForDifficultyPath,
} from "@/data/workoutProgram";
import { storage } from "@/lib/storage";
import {
  type UserProgramProgress,
  CONTROL_MODE_LABEL,
  CONTROL_MODE_TAGLINE,
  CONTROL_MODE_WEEKLY_TARGET,
  getControlModeWeeklyCount,
  getControlModeTodaysWorkout,
} from "@/lib/programCompletion";
import {
  RANK_TO_TIER,
  getWeekdayLabel,
  SEGMENT_TYPE_LABEL,
  EXERCISE_SEGMENT_TYPES,
} from "@/data/controlModeWorkouts";
import type { RankName } from "@/lib/controlScore";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_ENTER,
  ANIM_DELAY_STAGGER_XS,
} from "@/constants/animation";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

const DAY_TYPE_LABELS: Record<string, string> = {
  strength: "STR",
  speed: "SPD",
  coordination: "CRD",
  rest: "REST",
  daily: "DLY",
  alternate: "ALT",
};

const DAY_TYPE_NAMES: Record<string, string> = {
  strength: "Strength",
  speed: "Speed",
  coordination: "Coordination",
  rest: "Rest",
  daily: "Daily Driver",
  alternate: "Coordination",
};

export default function ProgramOverviewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { fontScale } = useAccessibility();
  const { cp, isDarkMode } = useThemePreference();

  const PHASE_COLORS: Record<string, string> = {
    Control: cp.neonCyan,
    Strength: cp.neonGreen,
    Power: cp.neonOrange,
    Maintenance: cp.neonPurple,
  };

  const DAY_TYPE_COLORS: Record<string, string> = {
    strength: cp.neonGreen,
    speed: cp.neonCyan,
    coordination: cp.neonPurple,
    rest: cp.textMuted,
    daily: cp.neonGreen,
    alternate: cp.neonCyan,
  };

  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [restDatesState, setRestDates] = useState<string[]>([]);
  const [programStartDate, setProgramStartDate] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [currentDayInWeek, setCurrentDayInWeek] = useState(0);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [displayWeeks, setDisplayWeeks] = useState<Week[]>(
    workoutProgram.weeks,
  );
  const [programProgress, setProgramProgress] =
    useState<UserProgramProgress | null>(null);
  const [lifetimeSessions, setLifetimeSessions] = useState(0);
  const [lifetimeMinutes, setLifetimeMinutes] = useState(0);
  const [currentRank, setCurrentRank] = useState<RankName | null>(null);
  const [recentSegmentTypeCounts, setRecentSegmentTypeCounts] = useState<
    Record<string, number>
  >({});
  const [expandedScheduleDay, setExpandedScheduleDay] = useState<number | null>(
    null,
  );
  const [expandedProgramDay, setExpandedProgramDay] = useState<{
    weekNumber: number;
    dayIndex: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    const todayStr = (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    })();
    const [
      dates,
      rDates,
      startDate,
      calibState,
      progress,
      sessions,
      minutes,
      score,
      segCounts,
    ] = await Promise.all([
      storage.getCompletedDates(),
      storage.getRestDates(),
      storage.getProgramStartDate(),
      storage.getCalibrationState(),
      storage.getProgramProgress(),
      storage.getTotalSessions(),
      storage.getTotalMinutes(),
      storage.getControlScoreState(),
      storage.getRecentSegmentTypeCounts(todayStr),
    ]);
    setCompletedDates(dates);
    setRestDates(rDates);
    setProgramStartDate(startDate);
    setProgramProgress(progress);
    setLifetimeSessions(sessions);
    setLifetimeMinutes(minutes);
    setCurrentRank(score?.currentRank ?? null);
    setRecentSegmentTypeCounts(segCounts);

    const week1Path: ChallengeDifficultyPath = calibState.calibrationCompleted
      ? calibState.difficultyPath
      : null;

    const weekPaths = await Promise.all(
      workoutProgram.weeks.map((w) =>
        w.weekNumber === 1
          ? Promise.resolve(week1Path)
          : storage.getDifficultyPathForWeek(w.weekNumber),
      ),
    );

    const adjustedWeeks: Week[] = workoutProgram.weeks.map((week, i) => {
      const path = weekPaths[i];
      if (week.weekNumber === 1) {
        return {
          ...week,
          days: week.days.map((_, dayIndex) =>
            getWeek1WorkoutForDayIndex(dayIndex, path),
          ),
        };
      }
      if (!path || path === "standard") return week;
      return {
        ...week,
        days: week.days.map((day) => getWorkoutForDifficultyPath(day, path)),
      };
    });
    setDisplayWeeks(adjustedWeeks);

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysSinceStart = Math.floor(
        (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      const week = Math.floor(daysSinceStart / 7) + 1;
      const dayInWeek = (daysSinceStart % 7) + 1;
      setCurrentWeek(Math.min(week, 12));
      setCurrentDayInWeek(week <= 12 ? dayInWeek : 0);
      setExpandedWeek(Math.min(week, 12));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const getDayDateStr = (weekNum: number, dayIndex: number): string | null => {
    if (!programStartDate) return null;
    const start = new Date(programStartDate);
    start.setHours(0, 0, 0, 0);
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + (weekNum - 1) * 7 + dayIndex);
    const year = dayDate.getFullYear();
    const month = String(dayDate.getMonth() + 1).padStart(2, "0");
    const day = String(dayDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isDayCompleted = (weekNum: number, dayIndex: number): boolean => {
    const dateStr = getDayDateStr(weekNum, dayIndex);
    if (!dateStr) return false;
    return completedDates.includes(dateStr);
  };

  const isCurrentDay = (weekNum: number, dayIndex: number): boolean => {
    return weekNum === currentWeek && dayIndex + 1 === currentDayInWeek;
  };

  const isDayInPast = (weekNum: number, dayIndex: number): boolean => {
    const dateStr = getDayDateStr(weekNum, dayIndex);
    if (!dateStr) return false;
    const dayDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dayDate < today;
  };

  const getWeekProgress = (
    week: Week,
  ): { completed: number; total: number } => {
    const workoutDays = week.days.filter((d) => !d.isRestDay);
    const total = workoutDays.length;
    let completed = 0;
    week.days.forEach((day, index) => {
      if (!day.isRestDay && isDayCompleted(week.weekNumber, index)) {
        completed++;
      }
    });
    return { completed, total };
  };

  const renderDayPill = (
    day: DayTemplate,
    dayIndex: number,
    weekNum: number,
  ) => {
    const completed = isDayCompleted(weekNum, dayIndex);
    const rest = day.isRestDay;
    const current = isCurrentDay(weekNum, dayIndex);
    const past = isDayInPast(weekNum, dayIndex);
    const color = DAY_TYPE_COLORS[day.dayType] || cp.neonGreen;

    return (
      <View key={dayIndex} style={styles.dayPillContainer}>
        <View
          style={[
            styles.dayPill,
            {
              borderColor: cp.cardBorder,
              backgroundColor: "rgba(255,255,255,0.03)",
            },
            rest
              ? [styles.dayPillRest, { borderColor: cp.divider }]
              : { borderColor: color + "50" },
            completed &&
              !rest && { backgroundColor: color, borderColor: color },
            completed &&
              rest && {
                backgroundColor: cp.neonCyan + "08",
                borderColor: cp.neonCyan + "20",
              },
            current && {
              borderWidth: 2,
              borderColor: cp.neonGreen,
              shadowColor: isDarkMode ? cp.neonGreen : "transparent",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 4,
            },
          ]}
        >
          {completed && !rest ? (
            <Feather name="check" size={12} color={cp.bg} />
          ) : (
            <Text
              style={[
                styles.dayPillText,
                {
                  color: completed
                    ? cp.neonCyan
                    : rest
                      ? cp.textMuted
                      : past
                        ? cp.textMuted
                        : cp.textSecondary,
                },
              ]}
            >
              {DAY_TYPE_LABELS[day.dayType]}
            </Text>
          )}
        </View>
        <Text style={[styles.dayLabel, { color: cp.textMuted }]}>
          D{dayIndex + 1}
        </Text>
      </View>
    );
  };

  const renderWeekExpanded = (week: Week) => {
    return (
      <View style={[styles.expandedContent, { borderTopColor: cp.divider }]}>
        {week.days.map((day, index) => {
          const completed = isDayCompleted(week.weekNumber, index);
          const rest = day.isRestDay;
          const current = isCurrentDay(week.weekNumber, index);
          const color = DAY_TYPE_COLORS[day.dayType] || cp.neonGreen;
          const dateStr = getDayDateStr(week.weekNumber, index);
          const dateLabel = dateStr
            ? new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : "";

          const isDayExpanded =
            expandedProgramDay?.weekNumber === week.weekNumber &&
            expandedProgramDay?.dayIndex === index;
          const segments = rest ? [] : day.segments;

          return (
            <View key={index}>
              <Pressable
                disabled={rest}
                onPress={() =>
                  setExpandedProgramDay(
                    isDayExpanded
                      ? null
                      : { weekNumber: week.weekNumber, dayIndex: index },
                  )
                }
                style={[
                  styles.expandedDayRow,
                  current && { backgroundColor: cp.neonGreen + "08" },
                ]}
                testID={`program-day-${week.weekNumber}-${index}`}
              >
                <View style={styles.expandedDayLeft}>
                  <View
                    style={[
                      styles.expandedDayDot,
                      { backgroundColor: rest ? cp.textMuted : color },
                      completed && !rest && { backgroundColor: color },
                      completed &&
                        rest && { backgroundColor: cp.neonCyan + "40" },
                    ]}
                  >
                    {completed && !rest ? (
                      <Feather name="check" size={10} color={cp.bg} />
                    ) : null}
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.expandedDayName,
                        { color: cp.text, fontSize: 13 * fontScale },
                      ]}
                    >
                      {rest ? "Rest Day" : DAY_TYPE_NAMES[day.dayType]}
                    </Text>
                    <Text
                      style={[styles.expandedDayDate, { color: cp.textMuted }]}
                    >
                      {dateLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.expandedDayRight}>
                  {rest ? (
                    <Text
                      style={[styles.expandedDayMeta, { color: cp.textMuted }]}
                    >
                      Recovery
                    </Text>
                  ) : (
                    <Text
                      style={[styles.expandedDayMeta, { color: cp.textMuted }]}
                    >
                      {day.estimatedMinutes} min
                    </Text>
                  )}
                  {current ? (
                    <View
                      style={[
                        styles.currentBadge,
                        {
                          backgroundColor: cp.neonGreen + "20",
                          borderColor: cp.neonGreen + "40",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currentBadgeText,
                          { color: cp.neonGreen },
                        ]}
                      >
                        TODAY
                      </Text>
                    </View>
                  ) : null}
                  {!rest ? (
                    <Feather
                      name={isDayExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={cp.textMuted}
                    />
                  ) : null}
                </View>
              </Pressable>
              {isDayExpanded && !rest ? (
                <View
                  style={[
                    styles.scheduleSegmentList,
                    { borderLeftColor: cp.neonCyan + "40" },
                  ]}
                  testID={`program-day-${week.weekNumber}-${index}-segments`}
                >
                  {segments.length === 0 ? (
                    <Text style={{ color: cp.textMuted, fontSize: 11 }}>
                      No segments scheduled
                    </Text>
                  ) : (
                    segments.map((s, si) => {
                      const isExercise = EXERCISE_SEGMENT_TYPES.includes(
                        s.type,
                      );
                      const typeLabel =
                        SEGMENT_TYPE_LABEL[s.type] ??
                        (s.type === "getReady"
                          ? "Prep"
                          : s.type === "blockRest"
                            ? "Block Rest"
                            : s.type === "breathing"
                              ? "Cool Down"
                              : s.type);
                      const totalReps = s.sets * s.repsPerSet;
                      const detail = isExercise
                        ? `${s.sets}×${s.repsPerSet} · ${s.squeezeSeconds}s hold · ${s.restSeconds}s rest`
                        : totalReps > 1
                          ? `${s.sets}×${s.repsPerSet} · ${s.restSeconds}s`
                          : `${s.restSeconds}s`;
                      return (
                        <View
                          key={`${s.id}-${si}`}
                          style={styles.scheduleSegmentRow}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: cp.text,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              {s.name}
                            </Text>
                            <Text
                              style={{
                                color: cp.textMuted,
                                fontSize: 11,
                                marginTop: 1,
                              }}
                            >
                              {typeLabel}
                            </Text>
                          </View>
                          <Text
                            style={{
                              color: cp.textSecondary,
                              fontSize: 11,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {detail}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  };

  const renderWeekCard = (week: Week, index: number) => {
    const phaseColor = PHASE_COLORS[week.phase] || cp.neonGreen;
    const progress = getWeekProgress(week);
    const isExpanded = expandedWeek === week.weekNumber;
    const isCurrent = week.weekNumber === currentWeek;
    const isPast = programStartDate ? week.weekNumber < currentWeek : false;
    const progressPercent =
      progress.total > 0 ? progress.completed / progress.total : 0;

    return (
      <Animated.View
        key={week.weekNumber}
        entering={FadeInDown.duration(ANIM_DURATION_ENTER).delay(
          index * ANIM_DELAY_STAGGER_XS,
        )}
      >
        <Pressable
          onPress={() => setExpandedWeek(isExpanded ? null : week.weekNumber)}
          style={[
            styles.weekCard,
            { backgroundColor: cp.cardBg, borderColor: cp.inputBg },
            isCurrent && { borderColor: phaseColor + "60" },
          ]}
          testID={`week-card-${week.weekNumber}`}
        >
          <View style={styles.weekHeader}>
            <View style={styles.weekHeaderLeft}>
              <View
                style={[
                  styles.weekBadge,
                  {
                    backgroundColor: phaseColor + "20",
                    borderColor: phaseColor + "40",
                  },
                ]}
              >
                <Text style={[styles.weekBadgeText, { color: phaseColor }]}>
                  W{week.weekNumber}
                </Text>
              </View>
              <View>
                <Text
                  style={[
                    styles.weekTitle,
                    { color: cp.text, fontSize: 15 * fontScale },
                  ]}
                >
                  {week.weekNumber === 1
                    ? "7-Day Challenge"
                    : `${week.phase} Phase`}
                </Text>
                <Text style={[styles.weekSubtitle, { color: cp.textMuted }]}>
                  {week.weekNumber === 1
                    ? "Calibration week — your first 7 days"
                    : week.phaseDescription}
                </Text>
              </View>
            </View>
            <View style={styles.weekHeaderRight}>
              {isPast || isCurrent ? (
                <View style={styles.progressContainer}>
                  <Text style={[styles.progressText, { color: phaseColor }]}>
                    {progress.completed}/{progress.total}
                  </Text>
                  <View
                    style={[
                      styles.progressBarBg,
                      { backgroundColor: cp.cardBorder },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progressPercent * 100}%`,
                          backgroundColor: phaseColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
              <Feather
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={cp.textMuted}
              />
            </View>
          </View>

          <View style={styles.dayPillsRow}>
            {week.days.map((day, dayIndex) =>
              renderDayPill(day, dayIndex, week.weekNumber),
            )}
          </View>

          {isExpanded ? renderWeekExpanded(week) : null}
        </Pressable>
      </Animated.View>
    );
  };

  const isControlMode =
    programProgress?.phase === "control_mode" &&
    programProgress?.controlModePath != null;

  if (isControlMode && programProgress?.controlModePath) {
    const path = programProgress.controlModePath;
    const target = CONTROL_MODE_WEEKLY_TARGET[path];
    const weeklyCount = getControlModeWeeklyCount(
      completedDates,
      restDatesState,
    );
    const tierLabel =
      programProgress.completionTier === "strong"
        ? "Strong Finish"
        : programProgress.completionTier === "partial"
          ? "Solid Finish"
          : "Restart";

    const todayStr = (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    })();
    const todayWeekday = ((new Date().getDay() + 6) % 7) as number;
    const controlPlan =
      path !== "rebuild" && programProgress.controlModeStartDate
        ? getControlModeTodaysWorkout(
            path,
            programProgress.controlModeStartDate,
            todayStr,
            {
              rank: currentRank ?? undefined,
              recentCompletions: completedDates.filter(
                (d) => !restDatesState.includes(d),
              ),
              recentSegmentTypeCounts: recentSegmentTypeCounts as Partial<
                Record<import("@/data/workoutProgram").SegmentType, number>
              >,
              pinnedRestWeekdays:
                programProgress.controlModePinnedRestWeekdays ?? [],
            },
          )
        : null;
    const tier = currentRank ? RANK_TO_TIER[currentRank] : null;
    const tierIntensityLabel =
      tier === "foundation"
        ? "lighter intensity"
        : tier === "building"
          ? "balanced intensity"
          : tier === "strong"
            ? "stronger intensity"
            : tier === "peak"
              ? "peak intensity"
              : "balanced intensity";
    const pinnedRestSet = new Set(controlPlan?.pinnedRestWeekdays ?? []);
    const restDayLabels =
      controlPlan?.preferredRestWeekdays?.map((i) => getWeekdayLabel(i)) ?? [];
    const pinnedLabels = (controlPlan?.pinnedRestWeekdays ?? []).map((i) =>
      getWeekdayLabel(i),
    );
    const detectedLabels = (controlPlan?.preferredRestWeekdays ?? [])
      .filter((i) => !pinnedRestSet.has(i))
      .map((i) => getWeekdayLabel(i));
    const weakAreaSuffix =
      controlPlan?.appliedWeakArea && controlPlan.weakAreaType
        ? ` Today focuses on ${SEGMENT_TYPE_LABEL[controlPlan.weakAreaType] ?? controlPlan.weakAreaType} — your least-trained area.`
        : "";
    const restPlanSentence = (() => {
      if (pinnedLabels.length > 0 && detectedLabels.length > 0) {
        return `rest pinned on ${pinnedLabels.join(", ")} and detected on ${detectedLabels.join(", ")}`;
      }
      if (pinnedLabels.length > 0) {
        return `rest pinned on ${pinnedLabels.join(", ")}`;
      }
      return `rest on ${restDayLabels.join(", ")}`;
    })();
    const tailoredNote = controlPlan
      ? controlPlan.appliedHabits
        ? `Tuned to your habits: ${tierIntensityLabel} for ${currentRank ?? "your rank"}, ${restPlanSentence}.${weakAreaSuffix}`
        : pinnedLabels.length > 0
          ? `${tierIntensityLabel.charAt(0).toUpperCase() + tierIntensityLabel.slice(1)} with ${restPlanSentence}. We will tune unpinned rest days as you build a routine.${weakAreaSuffix}`
          : `Default schedule with ${tierIntensityLabel}. We will tune rest days as you build a routine.${weakAreaSuffix}`
      : null;

    const togglePinnedRest = async (weekday: number) => {
      const current = new Set(
        programProgress.controlModePinnedRestWeekdays ?? [],
      );
      if (current.has(weekday)) current.delete(weekday);
      else current.add(weekday);
      const next = await storage.setControlModePinnedRestWeekdays(
        Array.from(current),
      );
      setProgramProgress(next);
    };
    return (
      <View style={styles.container} testID="program-overview-control-mode">
        <LinearGradient
          colors={cp.gradient as unknown as [string, string, ...string[]]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summarySection}>
            <Text
              style={[
                styles.sectionTitle,
                { color: cp.text, fontSize: 18 * fontScale },
              ]}
            >
              Control Mode · {CONTROL_MODE_LABEL[path]}
            </Text>
            <Text style={[styles.summaryText, { color: cp.textSecondary }]}>
              {tierLabel}
            </Text>
          </View>

          <Animated.View
            entering={FadeInDown.duration(ANIM_DURATION_ENTER)}
            style={[
              styles.weekCard,
              { backgroundColor: cp.cardBg, borderColor: cp.inputBg },
            ]}
            testID="control-mode-summary-card"
          >
            <Text
              style={[
                styles.weekTitle,
                { color: cp.text, fontSize: 16 * fontScale },
              ]}
            >
              {CONTROL_MODE_LABEL[path]}
            </Text>
            <Text
              style={[
                styles.weekSubtitle,
                { color: cp.textMuted, marginBottom: Spacing.md },
              ]}
            >
              {CONTROL_MODE_TAGLINE[path]}
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: Spacing.sm,
              }}
            >
              <Text style={{ color: cp.textSecondary, fontSize: 13 }}>
                This week
              </Text>
              <Text
                style={{ color: cp.neonCyan, fontWeight: "700", fontSize: 13 }}
                testID="text-control-week-count"
              >
                {weeklyCount} / {target} sessions
              </Text>
            </View>
            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: cp.cardBorder, width: "100%", height: 6 },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(1, weeklyCount / target) * 100}%`,
                    backgroundColor: cp.neonCyan,
                  },
                ]}
              />
            </View>
          </Animated.View>

          {controlPlan ? (
            <View
              style={[
                styles.weekCard,
                { backgroundColor: cp.cardBg, borderColor: cp.inputBg },
              ]}
              testID="control-mode-rest-pin-card"
            >
              <Text
                style={[
                  styles.weekTitle,
                  { color: cp.text, fontSize: 14 * fontScale },
                ]}
              >
                Rest day preferences
              </Text>
              <Text
                style={[
                  styles.weekSubtitle,
                  {
                    color: cp.textMuted,
                    marginTop: 4,
                    marginBottom: Spacing.sm,
                  },
                ]}
              >
                Tap a day to always rest. Unpinned days are auto-tuned.
              </Text>
              <View style={styles.dayPillsRow}>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const isPinned = pinnedRestSet.has(i);
                  const color = isPinned ? cp.neonCyan : cp.textMuted;
                  return (
                    <View key={i} style={styles.dayPillContainer}>
                      <Pressable
                        onPress={() => togglePinnedRest(i)}
                        style={[
                          styles.dayPill,
                          {
                            borderColor: color + "55",
                            backgroundColor: isPinned
                              ? color + "20"
                              : "transparent",
                          },
                          isPinned && {
                            borderWidth: 2,
                            borderColor: cp.neonCyan,
                          },
                        ]}
                        testID={`pin-rest-day-${i}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isPinned }}
                        accessibilityLabel={`${isPinned ? "Unpin" : "Pin"} rest on ${getWeekdayLabel(i)}`}
                      >
                        <Text
                          style={[
                            styles.dayPillText,
                            { color: isPinned ? cp.neonCyan : cp.textMuted },
                          ]}
                        >
                          {isPinned ? "REST" : "AUTO"}
                        </Text>
                      </Pressable>
                      <Text style={[styles.dayLabel, { color: cp.textMuted }]}>
                        {getWeekdayLabel(i)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {controlPlan && controlPlan.schedule ? (
            <View
              style={[
                styles.weekCard,
                { backgroundColor: cp.cardBg, borderColor: cp.inputBg },
              ]}
              testID="control-mode-schedule-card"
            >
              <Text
                style={[
                  styles.weekTitle,
                  { color: cp.text, fontSize: 14 * fontScale },
                ]}
              >
                This week&apos;s plan
              </Text>
              {tailoredNote ? (
                <Text
                  style={[
                    styles.weekSubtitle,
                    {
                      color: cp.textSecondary,
                      marginTop: 4,
                      marginBottom: Spacing.sm,
                    },
                  ]}
                  testID="text-control-mode-tailored-note"
                >
                  {tailoredNote}
                </Text>
              ) : null}
              <View style={styles.dayPillsRow}>
                {controlPlan.schedule.map((slot, i) => {
                  const isToday = i === todayWeekday;
                  const color = slot.isRestDay ? cp.textMuted : cp.neonCyan;
                  return (
                    <View key={i} style={styles.dayPillContainer}>
                      <View
                        style={[
                          styles.dayPill,
                          {
                            borderColor: color + "55",
                            backgroundColor: slot.isRestDay
                              ? "transparent"
                              : color + "15",
                          },
                          slot.isRestDay && styles.dayPillRest,
                          isToday && {
                            borderWidth: 2,
                            borderColor: cp.neonGreen,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayPillText,
                            { color: slot.isRestDay ? cp.textMuted : color },
                          ]}
                        >
                          {slot.isRestDay ? "REST" : "WORK"}
                        </Text>
                      </View>
                      <Text style={[styles.dayLabel, { color: cp.textMuted }]}>
                        {getWeekdayLabel(i)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View
                style={{
                  marginTop: Spacing.sm,
                  paddingTop: Spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: cp.divider,
                }}
              >
                {controlPlan.schedule.map((slot, i) => {
                  const isToday = i === todayWeekday;
                  const isExpanded = expandedScheduleDay === i;
                  const segments = slot.isRestDay ? [] : slot.template.segments;
                  return (
                    <View key={i}>
                      <Pressable
                        disabled={slot.isRestDay}
                        onPress={() =>
                          setExpandedScheduleDay(isExpanded ? null : i)
                        }
                        style={[
                          styles.scheduleDayRow,
                          isToday && {
                            backgroundColor: cp.neonGreen + "08",
                          },
                        ]}
                        testID={`schedule-day-${i}`}
                      >
                        <View style={styles.scheduleDayLeft}>
                          <Text
                            style={{ color: cp.textSecondary, fontSize: 12 }}
                          >
                            {getWeekdayLabel(i)}
                            {isToday ? " · Today" : ""}
                          </Text>
                        </View>
                        <View style={styles.scheduleDayRight}>
                          <Text
                            style={{
                              color: slot.isRestDay ? cp.textMuted : cp.text,
                              fontSize: 12,
                              fontWeight: "500",
                            }}
                          >
                            {slot.isRestDay
                              ? "Rest"
                              : `${slot.template.name} · ${slot.template.estimatedMinutes} min`}
                          </Text>
                          {!slot.isRestDay ? (
                            <Feather
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={14}
                              color={cp.textMuted}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                      {isExpanded && !slot.isRestDay ? (
                        <View
                          style={[
                            styles.scheduleSegmentList,
                            { borderLeftColor: cp.neonCyan + "40" },
                          ]}
                          testID={`schedule-day-${i}-segments`}
                        >
                          {segments.length === 0 ? (
                            <Text style={{ color: cp.textMuted, fontSize: 11 }}>
                              No segments scheduled
                            </Text>
                          ) : (
                            segments.map((s, si) => {
                              const isExercise =
                                EXERCISE_SEGMENT_TYPES.includes(s.type);
                              const typeLabel =
                                SEGMENT_TYPE_LABEL[s.type] ??
                                (s.type === "getReady"
                                  ? "Prep"
                                  : s.type === "blockRest"
                                    ? "Block Rest"
                                    : s.type === "breathing"
                                      ? "Cool Down"
                                      : s.type);
                              const totalReps = s.sets * s.repsPerSet;
                              const detail = isExercise
                                ? `${s.sets}×${s.repsPerSet} · ${s.squeezeSeconds}s hold · ${s.restSeconds}s rest`
                                : totalReps > 1
                                  ? `${s.sets}×${s.repsPerSet} · ${s.restSeconds}s`
                                  : `${s.restSeconds}s`;
                              return (
                                <View
                                  key={`${s.id}-${si}`}
                                  style={styles.scheduleSegmentRow}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={{
                                        color: cp.text,
                                        fontSize: 12,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {s.name}
                                    </Text>
                                    <Text
                                      style={{
                                        color: cp.textMuted,
                                        fontSize: 11,
                                        marginTop: 1,
                                      }}
                                    >
                                      {typeLabel}
                                    </Text>
                                  </View>
                                  <Text
                                    style={{
                                      color: cp.textSecondary,
                                      fontSize: 11,
                                      fontVariant: ["tabular-nums"],
                                    }}
                                  >
                                    {detail}
                                  </Text>
                                </View>
                              );
                            })
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.weekCard,
              { backgroundColor: cp.cardBg, borderColor: cp.inputBg },
            ]}
          >
            <Text
              style={[
                styles.weekTitle,
                { color: cp.text, fontSize: 14 * fontScale },
              ]}
            >
              Lifetime totals
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: Spacing.sm,
              }}
            >
              <View>
                <Text style={{ color: cp.textMuted, fontSize: 11 }}>
                  Sessions
                </Text>
                <Text
                  style={{ color: cp.text, fontSize: 18, fontWeight: "700" }}
                  testID="text-lifetime-sessions"
                >
                  {lifetimeSessions}
                </Text>
              </View>
              <View>
                <Text style={{ color: cp.textMuted, fontSize: 11 }}>
                  Minutes
                </Text>
                <Text
                  style={{ color: cp.text, fontSize: 18, fontWeight: "700" }}
                  testID="text-lifetime-minutes"
                >
                  {Math.round(lifetimeMinutes)}
                </Text>
              </View>
              <View>
                <Text style={{ color: cp.textMuted, fontSize: 11 }}>
                  Programs
                </Text>
                <Text
                  style={{ color: cp.text, fontSize: 18, fontWeight: "700" }}
                  testID="text-lifetime-programs"
                >
                  {programProgress.lifetimeProgramsCompleted}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summarySection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: cp.text, fontSize: 18 * fontScale },
            ]}
          >
            7-Day Challenge & 12-Week Program
          </Text>
          {programStartDate ? (
            <Text style={[styles.summaryText, { color: cp.textSecondary }]}>
              Week {Math.min(currentWeek, 12)} of 12
            </Text>
          ) : (
            <Text style={[styles.summaryText, { color: cp.textSecondary }]}>
              Not started yet
            </Text>
          )}
        </View>

        <View style={styles.phaseLegend}>
          {Object.entries(PHASE_COLORS).map(([phase, color]) => (
            <View key={phase} style={styles.phaseLegendItem}>
              <View
                style={[styles.phaseLegendDot, { backgroundColor: color }]}
              />
              <Text style={[styles.phaseLegendText, { color: cp.textMuted }]}>
                {phase}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.dayTypeLegend, { borderBottomColor: cp.divider }]}>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonGreen }]}>
              STR
            </Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>
              Strength
            </Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonCyan }]}>
              SPD
            </Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>
              Speed
            </Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonPurple }]}>
              CRD
            </Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>
              Coordination
            </Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonGreen }]}>
              DLY
            </Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>
              Daily Driver
            </Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonCyan }]}>
              ALT
            </Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>
              Alternating
            </Text>
          </View>
        </View>

        {displayWeeks.map((week, index) => renderWeekCard(week, index))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: "700",
  },
  summaryText: {
    fontSize: 13,
  },
  phaseLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  phaseLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  phaseLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseLegendText: {
    fontSize: 11,
  },
  dayTypeLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  dayTypeLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dayTypeLegendCode: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dayTypeLegendLabel: {
    fontSize: 10,
  },
  weekCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  weekHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  weekBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  weekBadgeText: {
    fontWeight: "700",
    fontSize: 13,
  },
  weekTitle: {
    fontWeight: "600",
  },
  weekSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  weekHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressContainer: {
    alignItems: "flex-end",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 3,
  },
  progressBarBg: {
    width: 40,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  dayPillsRow: {
    flexDirection: "row",
    gap: 4,
  },
  dayPillContainer: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  dayPill: {
    width: "100%",
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  dayPillRest: {
    backgroundColor: "transparent",
    borderStyle: "dashed",
  },
  dayPillText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dayLabel: {
    fontSize: 9,
  },
  expandedContent: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  expandedDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: Spacing.xs,
    borderRadius: 8,
  },
  expandedDayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  expandedDayDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedDayName: {
    fontWeight: "500",
  },
  expandedDayDate: {
    fontSize: 11,
    marginTop: 1,
  },
  expandedDayRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  expandedDayMeta: {
    fontSize: 12,
  },
  scheduleDayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: Spacing.xs,
    borderRadius: 6,
  },
  scheduleDayLeft: {
    flex: 1,
  },
  scheduleDayRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleSegmentList: {
    marginLeft: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingVertical: 4,
    borderLeftWidth: 2,
  },
  scheduleSegmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
