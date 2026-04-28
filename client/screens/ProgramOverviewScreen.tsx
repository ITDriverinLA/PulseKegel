import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { workoutProgram, Week, DayTemplate } from '@/data/workoutProgram';
import { storage } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ANIM_DURATION_ENTER } from '@/constants/animation';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';

const DAY_TYPE_LABELS: Record<string, string> = {
  strength: 'STR',
  speed: 'SPD',
  coordination: 'CRD',
  rest: 'REST',
  daily: 'DLY',
  alternate: 'ALT',
};

const DAY_TYPE_NAMES: Record<string, string> = {
  strength: 'Strength',
  speed: 'Speed',
  coordination: 'Coordination',
  rest: 'Rest',
  daily: 'Daily Driver',
  alternate: 'Coordination',
};

export default function ProgramOverviewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { fontScale, colors } = useAccessibility();
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
  const [restDates, setRestDates] = useState<string[]>([]);
  const [programStartDate, setProgramStartDate] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [currentDayInWeek, setCurrentDayInWeek] = useState(0);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const [dates, rDates, startDate] = await Promise.all([
      storage.getCompletedDates(),
      storage.getRestDates(),
      storage.getProgramStartDate(),
    ]);
    setCompletedDates(dates);
    setRestDates(rDates);
    setProgramStartDate(startDate);

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

  const getDayDateStr = (weekNum: number, dayIndex: number): string | null => {
    if (!programStartDate) return null;
    const start = new Date(programStartDate);
    start.setHours(0, 0, 0, 0);
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + (weekNum - 1) * 7 + dayIndex);
    const year = dayDate.getFullYear();
    const month = String(dayDate.getMonth() + 1).padStart(2, '0');
    const day = String(dayDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDayCompleted = (weekNum: number, dayIndex: number): boolean => {
    const dateStr = getDayDateStr(weekNum, dayIndex);
    if (!dateStr) return false;
    return completedDates.includes(dateStr);
  };

  const isDayRest = (weekNum: number, dayIndex: number): boolean => {
    const dateStr = getDayDateStr(weekNum, dayIndex);
    if (!dateStr) return false;
    return restDates.includes(dateStr);
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

  const getWeekProgress = (week: Week): { completed: number; total: number } => {
    const workoutDays = week.days.filter(d => !d.isRestDay);
    const total = workoutDays.length;
    let completed = 0;
    week.days.forEach((day, index) => {
      if (!day.isRestDay && isDayCompleted(week.weekNumber, index)) {
        completed++;
      }
    });
    return { completed, total };
  };

  const renderDayPill = (day: DayTemplate, dayIndex: number, weekNum: number) => {
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
            { borderColor: cp.cardBorder, backgroundColor: 'rgba(255,255,255,0.03)' },
            rest ? [styles.dayPillRest, { borderColor: cp.divider }] : { borderColor: color + '50' },
            completed && !rest && { backgroundColor: color, borderColor: color },
            completed && rest && { backgroundColor: cp.neonCyan + '08', borderColor: cp.neonCyan + '20' },
            current && { borderWidth: 2, borderColor: cp.neonGreen, shadowColor: isDarkMode ? cp.neonGreen : 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
          ]}
        >
          {completed && !rest ? (
            <Feather name="check" size={12} color={cp.bg} />
          ) : (
            <Text
              style={[
                styles.dayPillText,
                { color: completed ? cp.neonCyan : rest ? cp.textMuted : past ? cp.textMuted : cp.textSecondary },
              ]}
            >
              {DAY_TYPE_LABELS[day.dayType]}
            </Text>
          )}
        </View>
        <Text style={[styles.dayLabel, { color: cp.textMuted }]}>D{dayIndex + 1}</Text>
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
            ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            : '';

          return (
            <View
              key={index}
              style={[
                styles.expandedDayRow,
                current && { backgroundColor: cp.neonGreen + '08' },
              ]}
            >
              <View style={styles.expandedDayLeft}>
                <View
                  style={[
                    styles.expandedDayDot,
                    { backgroundColor: rest ? cp.textMuted : color },
                    completed && !rest && { backgroundColor: color },
                    completed && rest && { backgroundColor: cp.neonCyan + '40' },
                  ]}
                >
                  {completed && !rest ? (
                    <Feather name="check" size={10} color={cp.bg} />
                  ) : null}
                </View>
                <View>
                  <Text style={[styles.expandedDayName, { color: cp.text, fontSize: 13 * fontScale }]}>
                    {rest ? 'Rest Day' : DAY_TYPE_NAMES[day.dayType]}
                  </Text>
                  <Text style={[styles.expandedDayDate, { color: cp.textMuted }]}>{dateLabel}</Text>
                </View>
              </View>
              <View style={styles.expandedDayRight}>
                {rest ? (
                  <Text style={[styles.expandedDayMeta, { color: cp.textMuted }]}>Recovery</Text>
                ) : (
                  <Text style={[styles.expandedDayMeta, { color: cp.textMuted }]}>{day.estimatedMinutes} min</Text>
                )}
                {current ? (
                  <View style={[styles.currentBadge, { backgroundColor: cp.neonGreen + '20', borderColor: cp.neonGreen + '40' }]}>
                    <Text style={[styles.currentBadgeText, { color: cp.neonGreen }]}>TODAY</Text>
                  </View>
                ) : null}
              </View>
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
    const progressPercent = progress.total > 0 ? progress.completed / progress.total : 0;

    return (
      <Animated.View
        key={week.weekNumber}
        entering={FadeInDown.duration(ANIM_DURATION_ENTER).delay(index * 50)}
      >
        <Pressable
          onPress={() => setExpandedWeek(isExpanded ? null : week.weekNumber)}
          style={[
            styles.weekCard,
            { backgroundColor: cp.cardBg, borderColor: cp.inputBg },
            isCurrent && { borderColor: phaseColor + '60' },
          ]}
          testID={`week-card-${week.weekNumber}`}
        >
          <View style={styles.weekHeader}>
            <View style={styles.weekHeaderLeft}>
              <View style={[styles.weekBadge, { backgroundColor: phaseColor + '20', borderColor: phaseColor + '40' }]}>
                <Text style={[styles.weekBadgeText, { color: phaseColor }]}>W{week.weekNumber}</Text>
              </View>
              <View>
                <Text style={[styles.weekTitle, { color: cp.text, fontSize: 15 * fontScale }]}>
                  {week.phase} Phase
                </Text>
                <Text style={[styles.weekSubtitle, { color: cp.textMuted }]}>{week.phaseDescription}</Text>
              </View>
            </View>
            <View style={styles.weekHeaderRight}>
              {isPast || isCurrent ? (
                <View style={styles.progressContainer}>
                  <Text style={[styles.progressText, { color: phaseColor }]}>
                    {progress.completed}/{progress.total}
                  </Text>
                  <View style={[styles.progressBarBg, { backgroundColor: cp.cardBorder }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${progressPercent * 100}%`, backgroundColor: phaseColor },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
              <Feather
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={cp.textMuted}
              />
            </View>
          </View>

          <View style={styles.dayPillsRow}>
            {week.days.map((day, dayIndex) => renderDayPill(day, dayIndex, week.weekNumber))}
          </View>

          {isExpanded ? renderWeekExpanded(week) : null}
        </Pressable>
      </Animated.View>
    );
  };

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
          <Text style={[styles.sectionTitle, { color: cp.text, fontSize: 18 * fontScale }]}>
            12-Week Program
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
              <View style={[styles.phaseLegendDot, { backgroundColor: color }]} />
              <Text style={[styles.phaseLegendText, { color: cp.textMuted }]}>{phase}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.dayTypeLegend, { borderBottomColor: cp.divider }]}>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonGreen }]}>STR</Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>Strength</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonCyan }]}>SPD</Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>Speed</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonPurple }]}>CRD</Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>Coordination</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonGreen }]}>DLY</Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>Daily Driver</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: cp.neonCyan }]}>ALT</Text>
            <Text style={[styles.dayTypeLegendLabel, { color: cp.textMuted }]}>Alternating</Text>
          </View>
        </View>

        {workoutProgram.weeks.map((week, index) => renderWeekCard(week, index))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  summaryText: {
    fontSize: 13,
  },
  phaseLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  phaseLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  dayTypeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dayTypeLegendCode: {
    fontSize: 10,
    fontWeight: '700',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  weekHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  weekBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  weekBadgeText: {
    fontWeight: '700',
    fontSize: 13,
  },
  weekTitle: {
    fontWeight: '600',
  },
  weekSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  weekHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  progressBarBg: {
    width: 40,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  dayPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayPillContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  dayPill: {
    width: '100%',
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayPillRest: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  dayPillText: {
    fontSize: 9,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: Spacing.xs,
    borderRadius: 8,
  },
  expandedDayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  expandedDayDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedDayName: {
    fontWeight: '500',
  },
  expandedDayDate: {
    fontSize: 11,
    marginTop: 1,
  },
  expandedDayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  expandedDayMeta: {
    fontSize: 12,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
