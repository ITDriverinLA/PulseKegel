import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Image, RefreshControl, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { StatCard } from '@/components/StatCard';
import { CalendarGrid } from '@/components/CalendarGrid';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, UserProgress } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const { fontScale, colors, highContrast } = useAccessibility();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const startDate = await storage.getProgramStartDate();
    await storage.backfillRestDays(startDate);
    const userProgress = await storage.getProgress();
    setProgress(userProgress);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const hasProgress = progress && progress.completedDates.length > 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={NEON_CYAN}
          />
        }
      >
        {hasProgress ? (
          <>
            <Animated.View
              entering={FadeInDown.duration(400).delay(100)}
              style={styles.statsContainer}
            >
              <StatCard
                icon="zap"
                label="Current Streak"
                value={progress.currentStreak}
                color={NEON_GREEN}
                darkMode
              />
              <View style={{ width: Spacing.sm }} />
              <StatCard
                icon="check-circle"
                label="Total Sessions"
                value={progress.totalSessions}
                color={NEON_CYAN}
                darkMode
              />
              <View style={{ width: Spacing.sm }} />
              <StatCard
                icon="clock"
                label="Total Minutes"
                value={progress.totalMinutes}
                color={NEON_PINK}
                darkMode
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(200)}>
              <CalendarGrid
                completedDates={progress.completedDates}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                darkMode
              />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(400).delay(300)}
              style={styles.longestStreakContainer}
            >
              <View style={[styles.longestStreakCard, highContrast && { borderColor: colors.border }]}>
                <Text style={[styles.longestStreakLabel, { fontSize: 12 * fontScale, color: colors.textSecondary }]}>
                  Longest Streak
                </Text>
                <Text style={[styles.longestStreakValue, { fontSize: 20 * fontScale, color: colors.accent }]}>
                  {progress.longestStreak} days
                </Text>
              </View>
            </Animated.View>
          </>
        ) : (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.emptyContainer}
          >
            <Image
              source={require('../../assets/images/empty-progress.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>
              Start Your Journey
            </Text>
            <Text style={styles.emptyDescription}>
              Complete your first workout to begin tracking your progress here.
            </Text>
          </Animated.View>
        )}
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
  statsContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  longestStreakContainer: {
    marginTop: Spacing.lg,
  },
  longestStreakCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  longestStreakLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  longestStreakValue: {
    fontSize: 20,
    fontWeight: '600',
    color: NEON_GREEN,
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginBottom: Spacing['2xl'],
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  emptyDescription: {
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
});
