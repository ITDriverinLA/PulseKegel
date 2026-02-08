import React, { useMemo } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';

interface CalendarGridProps {
  completedDates: string[];
  restDates?: string[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  darkMode?: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarGrid({
  completedDates,
  restDates = [],
  currentMonth,
  onMonthChange,
  darkMode,
}: CalendarGridProps) {
  const { theme } = useTheme();

  const { days, monthLabel } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const daysArray: (number | null)[] = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      daysArray.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      daysArray.push(i);
    }
    
    while (daysArray.length % 7 !== 0) {
      daysArray.push(null);
    }

    const label = firstDay.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    return { days: daysArray, monthLabel: label };
  }, [currentMonth]);

  const completedSet = useMemo(() => new Set(completedDates), [completedDates]);
  const restSet = useMemo(() => new Set(restDates), [restDates]);

  const getDateStr = (day: number): string => {
    return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isCompleted = (day: number): boolean => {
    return completedSet.has(getDateStr(day));
  };

  const isRestDay = (day: number): boolean => {
    return restSet.has(getDateStr(day));
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const goToPrevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const getDayStyle = (day: number) => {
    const rest = isRestDay(day);
    const completed = isCompleted(day);
    const today = isToday(day);

    if (darkMode) {
      if (rest) {
        return {
          circle: styles.darkRestCircle,
          text: styles.restDayText,
        };
      }
      if (completed) {
        return {
          circle: styles.darkCompletedCircle,
          text: styles.completedText,
        };
      }
      if (today) {
        return {
          circle: styles.darkTodayCircle,
          text: styles.darkDayText,
        };
      }
      return {
        circle: undefined,
        text: styles.darkDayText,
      };
    }

    if (rest) {
      return {
        circle: [styles.restCircle, { backgroundColor: NEON_CYAN + '30', borderColor: NEON_CYAN + '60' }],
        text: [styles.dayText, { color: NEON_CYAN }],
      };
    }
    if (completed) {
      return {
        circle: [styles.completedCircle, { backgroundColor: theme.success }],
        text: styles.completedText,
      };
    }
    if (today) {
      return {
        circle: [styles.todayCircle, { borderColor: theme.primary }],
        text: styles.dayText,
      };
    }
    return {
      circle: undefined,
      text: styles.dayText,
    };
  };

  const renderLegend = () => {
    if (!darkMode) return null;
    return (
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: NEON_GREEN }]} />
          <Text style={styles.legendText}>Workout</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: NEON_CYAN, opacity: 0.6 }]} />
          <Text style={styles.legendText}>Rest Day</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDotOutline, { borderColor: NEON_CYAN }]} />
          <Text style={styles.legendText}>Today</Text>
        </View>
      </View>
    );
  };

  if (darkMode) {
    return (
      <View style={styles.darkContainer}>
        <View style={styles.header}>
          <Pressable onPress={goToPrevMonth} style={styles.navButton}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.darkMonthLabel}>{monthLabel}</Text>
          <Pressable onPress={goToNextMonth} style={styles.navButton}>
            <Feather name="chevron-right" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((day, index) => (
            <View key={index} style={styles.weekdayCell}>
              <Text style={styles.darkWeekdayText}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={index} style={styles.dayCell} />;
            }
            const dayStyle = getDayStyle(day);
            return (
              <View key={index} style={styles.dayCell}>
                <View style={[styles.dayContent, dayStyle.circle]}>
                  <Text style={dayStyle.text}>
                    {day}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {renderLegend()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.header}>
        <Pressable onPress={goToPrevMonth} style={styles.navButton}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h4">{monthLabel}</ThemedText>
        <Pressable onPress={goToNextMonth} style={styles.navButton}>
          <Feather name="chevron-right" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day, index) => (
          <View key={index} style={styles.weekdayCell}>
            <ThemedText
              type="caption"
              style={[styles.weekdayText, { color: theme.textSecondary }]}
            >
              {day}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day, index) => {
          if (day === null) {
            return <View key={index} style={styles.dayCell} />;
          }
          const dayStyle = getDayStyle(day);
          return (
            <View key={index} style={styles.dayCell}>
              <View style={[styles.dayContent, dayStyle.circle]}>
                <ThemedText type="small" style={dayStyle.text}>
                  {day}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  darkContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  navButton: {
    padding: Spacing.xs,
  },
  darkMonthLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontWeight: '600',
  },
  darkWeekdayText: {
    fontWeight: '600',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  dayContent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    borderWidth: 2,
  },
  darkTodayCircle: {
    borderWidth: 2,
    borderColor: NEON_CYAN,
  },
  completedCircle: {
    borderWidth: 0,
  },
  darkCompletedCircle: {
    backgroundColor: NEON_GREEN,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  restCircle: {
    borderWidth: 1,
  },
  darkRestCircle: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.35)',
  },
  dayText: {
    textAlign: 'center',
  },
  darkDayText: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  completedText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  restDayText: {
    color: NEON_CYAN,
    fontWeight: '500',
    fontSize: 12,
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotOutline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  legendText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
});
