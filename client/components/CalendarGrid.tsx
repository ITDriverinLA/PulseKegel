import React, { useMemo } from "react";
import { StyleSheet, View, Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface CalendarGridProps {
  completedDates: string[];
  workoutDates?: string[];
  restDates?: string[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarGrid({
  completedDates,
  workoutDates = [],
  restDates = [],
  currentMonth,
  onMonthChange,
}: CalendarGridProps) {
  const { cp, isDarkMode } = useThemePreference();

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

    const label = firstDay.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    return { days: daysArray, monthLabel: label };
  }, [currentMonth]);

  const completedSet = useMemo(() => new Set(completedDates), [completedDates]);
  const workoutSet = useMemo(() => new Set(workoutDates), [workoutDates]);
  const restSet = useMemo(() => new Set(restDates), [restDates]);

  const getDateStr = (day: number): string => {
    return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

  const isRealWorkout = (day: number): boolean => {
    return workoutSet.has(getDateStr(day));
  };

  const getDayStyle = (day: number) => {
    const realWorkout = isRealWorkout(day);
    const rest = isRestDay(day);
    const completed = isCompleted(day);
    const today = isToday(day);

    // Real workout completions (recorded by the user) always render green,
    // even if the scheduled program marks that day as a rest day.
    if (realWorkout || (!rest && completed)) {
      return {
        circle: {
          backgroundColor: cp.neonGreen,
          shadowColor: cp.neonGreen,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 8,
          elevation: 8,
        },
        text: {
          color: "#FFFFFF",
          fontWeight: "600" as const,
          fontSize: 12,
          textAlign: "center" as const,
        },
      };
    }
    if (rest) {
      return {
        circle: {
          backgroundColor: cp.neonCyan + "30",
          borderWidth: 1,
          borderColor: cp.neonCyan + "60",
        },
        text: {
          color: cp.neonCyan,
          fontWeight: "500" as const,
          fontSize: 12,
          textAlign: "center" as const,
        },
      };
    }
    if (today) {
      return {
        circle: { borderWidth: 2, borderColor: cp.neonCyan },
        text: { color: cp.text, fontSize: 12, textAlign: "center" as const },
      };
    }
    return {
      circle: undefined,
      text: {
        color: isDarkMode ? "rgba(255,255,255,0.8)" : cp.text,
        fontSize: 12,
        textAlign: "center" as const,
      },
    };
  };

  const renderLegend = () => {
    return (
      <View style={[styles.legendContainer, { borderTopColor: cp.cardBorder }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: cp.neonGreen }]} />
          <Text style={[styles.legendText, { color: cp.textMuted }]}>
            Workout
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: cp.neonCyan, opacity: 0.6 },
            ]}
          />
          <Text style={[styles.legendText, { color: cp.textMuted }]}>
            Rest Day
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDotOutline, { borderColor: cp.neonCyan }]}
          />
          <Text style={[styles.legendText, { color: cp.textMuted }]}>
            Today
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={goToPrevMonth} style={styles.navButton}>
          <Feather name="chevron-left" size={24} color={cp.text} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: cp.text }]}>
          {monthLabel}
        </Text>
        <Pressable onPress={goToNextMonth} style={styles.navButton}>
          <Feather name="chevron-right" size={24} color={cp.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text style={[styles.weekdayText, { color: cp.textSecondary }]}>
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
                <Text style={dayStyle.text}>{day}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {renderLegend()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  navButton: {
    padding: Spacing.xs,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayText: {
    fontWeight: "600",
    fontSize: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
  },
  dayContent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
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
    fontSize: 11,
  },
});
