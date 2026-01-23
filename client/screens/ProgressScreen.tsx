import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Image, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ThemedText } from '@/components/ThemedText';
import { StatCard } from '@/components/StatCard';
import { CalendarGrid } from '@/components/CalendarGrid';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, UserProgress } from '@/lib/storage';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
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
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
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
          tintColor={theme.primary}
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
              color={theme.success}
            />
            <View style={{ width: Spacing.sm }} />
            <StatCard
              icon="check-circle"
              label="Total Sessions"
              value={progress.totalSessions}
              color={theme.primary}
            />
            <View style={{ width: Spacing.sm }} />
            <StatCard
              icon="clock"
              label="Total Minutes"
              value={progress.totalMinutes}
              color={theme.warning}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <CalendarGrid
              completedDates={progress.completedDates}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(300)}
            style={styles.longestStreakContainer}
          >
            <View
              style={[
                styles.longestStreakCard,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Longest Streak
              </ThemedText>
              <ThemedText type="h2" style={[styles.longestStreak, { color: theme.success }]}>
                {progress.longestStreak} days
              </ThemedText>
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
          <ThemedText type="h3" style={styles.emptyTitle}>
            Start Your Journey
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.emptyDescription, { color: theme.textSecondary }]}
          >
            Complete your first workout to begin tracking your progress here.
          </ThemedText>
        </Animated.View>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
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
  },
  longestStreak: {
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
  },
  emptyDescription: {
    textAlign: 'center',
    lineHeight: 24,
  },
});
