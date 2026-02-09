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

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';
const NEON_PURPLE = '#BB86FC';
const NEON_ORANGE = '#FF9500';

const PHASE_COLORS: Record<string, string> = {
  Control: NEON_CYAN,
  Strength: NEON_GREEN,
  Power: NEON_ORANGE,
  Maintenance: NEON_PURPLE,
};

const DAY_TYPE_LABELS: Record<string, string> = {
  strength: 'STR',
  speed: 'SPD',
  coordination: 'CRD',
  rest: 'REST',
  daily: 'DLY',
  alternate: 'ALT',
};

const DAY_TYPE_COLORS: Record<string, string> = {
  strength: NEON_GREEN,
  speed: NEON_CYAN,
  coordination: NEON_PURPLE,
  rest: 'rgba(255,255,255,0.3)',
  daily: NEON_GREEN,
  alternate: NEON_CYAN,
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
    const color = DAY_TYPE_COLORS[day.dayType] || NEON_GREEN;

    return (
      <View key={dayIndex} style={styles.dayPillContainer}>
        <View
          style={[
            styles.dayPill,
            rest ? styles.dayPillRest : { borderColor: color + '50' },
            completed && !rest && { backgroundColor: color, borderColor: color },
            completed && rest && styles.dayPillRestCompleted,
            current && styles.dayPillCurrent,
          ]}
        >
          {completed && !rest ? (
            <Feather name="check" size={12} color="#0a0a1a" />
          ) : (
            <Text
              style={[
                styles.dayPillText,
                { color: completed ? NEON_CYAN : rest ? 'rgba(255,255,255,0.3)' : past ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)' },
              ]}
            >
              {DAY_TYPE_LABELS[day.dayType]}
            </Text>
          )}
        </View>
        <Text style={styles.dayLabel}>D{dayIndex + 1}</Text>
      </View>
    );
  };

  const renderWeekExpanded = (week: Week) => {
    return (
      <View style={styles.expandedContent}>
        {week.days.map((day, index) => {
          const completed = isDayCompleted(week.weekNumber, index);
          const rest = day.isRestDay;
          const current = isCurrentDay(week.weekNumber, index);
          const color = DAY_TYPE_COLORS[day.dayType] || NEON_GREEN;
          const dateStr = getDayDateStr(week.weekNumber, index);
          const dateLabel = dateStr
            ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            : '';

          return (
            <View
              key={index}
              style={[
                styles.expandedDayRow,
                current && styles.expandedDayCurrent,
              ]}
            >
              <View style={styles.expandedDayLeft}>
                <View
                  style={[
                    styles.expandedDayDot,
                    { backgroundColor: rest ? 'rgba(255,255,255,0.2)' : color },
                    completed && !rest && { backgroundColor: color },
                    completed && rest && { backgroundColor: NEON_CYAN + '40' },
                  ]}
                >
                  {completed && !rest ? (
                    <Feather name="check" size={10} color="#0a0a1a" />
                  ) : null}
                </View>
                <View>
                  <Text style={[styles.expandedDayName, { fontSize: 13 * fontScale }]}>
                    {rest ? 'Rest Day' : DAY_TYPE_NAMES[day.dayType]}
                  </Text>
                  <Text style={styles.expandedDayDate}>{dateLabel}</Text>
                </View>
              </View>
              <View style={styles.expandedDayRight}>
                {rest ? (
                  <Text style={styles.expandedDayMeta}>Recovery</Text>
                ) : (
                  <Text style={styles.expandedDayMeta}>{day.estimatedMinutes} min</Text>
                )}
                {current ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>TODAY</Text>
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
    const phaseColor = PHASE_COLORS[week.phase] || NEON_GREEN;
    const progress = getWeekProgress(week);
    const isExpanded = expandedWeek === week.weekNumber;
    const isCurrent = week.weekNumber === currentWeek;
    const isPast = programStartDate ? week.weekNumber < currentWeek : false;
    const progressPercent = progress.total > 0 ? progress.completed / progress.total : 0;

    return (
      <Animated.View
        key={week.weekNumber}
        entering={FadeInDown.duration(300).delay(index * 50)}
      >
        <Pressable
          onPress={() => setExpandedWeek(isExpanded ? null : week.weekNumber)}
          style={[
            styles.weekCard,
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
                <Text style={[styles.weekTitle, { fontSize: 15 * fontScale }]}>
                  {week.phase} Phase
                </Text>
                <Text style={styles.weekSubtitle}>{week.phaseDescription}</Text>
              </View>
            </View>
            <View style={styles.weekHeaderRight}>
              {isPast || isCurrent ? (
                <View style={styles.progressContainer}>
                  <Text style={[styles.progressText, { color: phaseColor }]}>
                    {progress.completed}/{progress.total}
                  </Text>
                  <View style={styles.progressBarBg}>
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
                color="rgba(255,255,255,0.5)"
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
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
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
          <Text style={[styles.sectionTitle, { fontSize: 18 * fontScale }]}>
            12-Week Program
          </Text>
          {programStartDate ? (
            <Text style={styles.summaryText}>
              Week {Math.min(currentWeek, 12)} of 12
            </Text>
          ) : (
            <Text style={styles.summaryText}>
              Not started yet
            </Text>
          )}
        </View>

        <View style={styles.phaseLegend}>
          {Object.entries(PHASE_COLORS).map(([phase, color]) => (
            <View key={phase} style={styles.phaseLegendItem}>
              <View style={[styles.phaseLegendDot, { backgroundColor: color }]} />
              <Text style={styles.phaseLegendText}>{phase}</Text>
            </View>
          ))}
        </View>

        <View style={styles.dayTypeLegend}>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: NEON_GREEN }]}>STR</Text>
            <Text style={styles.dayTypeLegendLabel}>Strength</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: NEON_CYAN }]}>SPD</Text>
            <Text style={styles.dayTypeLegendLabel}>Speed</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: NEON_PURPLE }]}>CRD</Text>
            <Text style={styles.dayTypeLegendLabel}>Coordination</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: NEON_GREEN }]}>DLY</Text>
            <Text style={styles.dayTypeLegendLabel}>Daily Driver</Text>
          </View>
          <View style={styles.dayTypeLegendItem}>
            <Text style={[styles.dayTypeLegendCode, { color: NEON_CYAN }]}>ALT</Text>
            <Text style={styles.dayTypeLegendLabel}>Alternating</Text>
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
    color: '#fff',
    fontWeight: '700',
  },
  summaryText: {
    color: 'rgba(255,255,255,0.6)',
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
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  dayTypeLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  weekCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    color: '#fff',
    fontWeight: '600',
  },
  weekSubtitle: {
    color: 'rgba(255,255,255,0.4)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dayPillRest: {
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  dayPillRestCompleted: {
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  dayPillCurrent: {
    borderWidth: 2,
    borderColor: NEON_GREEN,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  dayPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
  },
  expandedContent: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  expandedDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: Spacing.xs,
    borderRadius: 8,
  },
  expandedDayCurrent: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
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
    color: '#fff',
    fontWeight: '500',
  },
  expandedDayDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 1,
  },
  expandedDayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  expandedDayMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  currentBadge: {
    backgroundColor: NEON_GREEN + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: NEON_GREEN + '40',
  },
  currentBadgeText: {
    color: NEON_GREEN,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
