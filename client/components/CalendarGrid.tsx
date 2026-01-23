import React, { useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

interface CalendarGridProps {
  completedDates: string[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarGrid({
  completedDates,
  currentMonth,
  onMonthChange,
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

  const isCompleted = (day: number): boolean => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return completedSet.has(dateStr);
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
        {days.map((day, index) => (
          <View key={index} style={styles.dayCell}>
            {day !== null ? (
              <View
                style={[
                  styles.dayContent,
                  isToday(day) && [styles.todayCircle, { borderColor: theme.primary }],
                  isCompleted(day) && [styles.completedCircle, { backgroundColor: theme.success }],
                ]}
              >
                <ThemedText
                  type="small"
                  style={[
                    styles.dayText,
                    isCompleted(day) && styles.completedText,
                  ]}
                >
                  {day}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
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
  completedCircle: {
    borderWidth: 0,
  },
  dayText: {
    textAlign: 'center',
  },
  completedText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
