import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Image, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Toggle } from '@/components/Toggle';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, UserSettings, UserProgress, defaultSettings } from '@/lib/storage';
import {
  getTodaysWorkout,
  getWorkoutForRecoveryMode,
  DayTemplate,
  Week,
} from '@/data/workoutProgram';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [todaysWorkout, setTodaysWorkout] = useState<{
    week: Week;
    dayIndex: number;
    workout: DayTemplate;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [userProgress, userSettings, startDate] = await Promise.all([
      storage.getProgress(),
      storage.getSettings(),
      storage.getProgramStartDate(),
    ]);
    
    setProgress(userProgress);
    setSettings(userSettings);
    
    const workout = getTodaysWorkout(userProgress.completedDates, startDate || undefined);
    setTodaysWorkout(workout);
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

  const handleRecoveryModeChange = async (value: boolean) => {
    await storage.saveSettings({ recoveryMode: value });
    setSettings(prev => ({ ...prev, recoveryMode: value }));
  };

  const handleStartWorkout = () => {
    if (!todaysWorkout) return;
    
    const workout = settings.recoveryMode
      ? getWorkoutForRecoveryMode(todaysWorkout.workout)
      : todaysWorkout.workout;
    
    navigation.navigate('WorkoutPlayer', {
      workout,
      weekNumber: todaysWorkout.week.weekNumber,
      phase: todaysWorkout.week.phase,
    });
  };

  const formatLastCompleted = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
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
          tintColor={theme.primary}
        />
      }
    >
      <Animated.View entering={FadeInDown.duration(400).delay(100)}>
        <View style={styles.streakContainer}>
          <View
            style={[
              styles.streakBadge,
              { backgroundColor: `${theme.success}15` },
            ]}
          >
            <Feather name="zap" size={24} color={theme.success} />
            <ThemedText type="h2" style={[styles.streakNumber, { color: theme.success }]}>
              {progress?.currentStreak || 0}
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.streakLabel, { color: theme.textSecondary }]}
            >
              Day Streak
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(200)}>
        <Card elevation={1} style={styles.workoutCard}>
          {todaysWorkout ? (
            <>
              <View style={styles.workoutHeader}>
                <View>
                  <ThemedText
                    type="small"
                    style={[styles.phaseLabel, { color: theme.primary }]}
                  >
                    Week {todaysWorkout.week.weekNumber} - {todaysWorkout.week.phase}
                  </ThemedText>
                  <ThemedText type="h3" style={styles.workoutTitle}>
                    {todaysWorkout.workout.name}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.durationBadge,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather name="clock" size={14} color={theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
                  >
                    {settings.recoveryMode
                      ? getWorkoutForRecoveryMode(todaysWorkout.workout).estimatedMinutes
                      : todaysWorkout.workout.estimatedMinutes}{' '}
                    min
                  </ThemedText>
                </View>
              </View>

              <ThemedText
                type="small"
                style={[styles.phaseDescription, { color: theme.textSecondary }]}
              >
                {todaysWorkout.week.phaseDescription}
              </ThemedText>

              <View style={styles.segmentsList}>
                {(settings.recoveryMode
                  ? getWorkoutForRecoveryMode(todaysWorkout.workout)
                  : todaysWorkout.workout
                ).segments.map((segment, index) => (
                  <View key={segment.id} style={styles.segmentItem}>
                    <View
                      style={[
                        styles.segmentDot,
                        { backgroundColor: theme.primary },
                      ]}
                    />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {segment.name} ({segment.sets}x{segment.repsPerSet})
                    </ThemedText>
                  </View>
                ))}
              </View>

              <Button onPress={handleStartWorkout} style={styles.startButton}>
                Start Workout
              </Button>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <ThemedText type="body">Loading workout...</ThemedText>
            </View>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(300)}>
        <Card elevation={1} style={styles.recoveryCard}>
          <View style={styles.recoveryHeader}>
            <View style={styles.recoveryInfo}>
              <View
                style={[
                  styles.recoveryIcon,
                  { backgroundColor: `${theme.warning}15` },
                ]}
              >
                <Feather name="heart" size={20} color={theme.warning} />
              </View>
              <View style={styles.recoveryText}>
                <ThemedText type="body" style={{ fontWeight: '600' }}>
                  Recovery Mode
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary }}
                >
                  Reduced intensity with relaxation
                </ThemedText>
              </View>
            </View>
            <Toggle
              value={settings.recoveryMode}
              onValueChange={handleRecoveryModeChange}
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(400)}>
        <View style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="check-circle" size={18} color={theme.primary} />
            <ThemedText type="body" style={styles.statValue}>
              {progress?.totalSessions || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Sessions
            </ThemedText>
          </View>
          
          <View style={[styles.statItem, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="clock" size={18} color={theme.primary} />
            <ThemedText type="body" style={styles.statValue}>
              {progress?.totalMinutes || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Minutes
            </ThemedText>
          </View>
          
          <View style={[styles.statItem, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="calendar" size={18} color={theme.primary} />
            <ThemedText type="body" style={styles.statValue}>
              {formatLastCompleted(progress?.lastCompletedDate || null)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Last Done
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  streakContainer: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  streakBadge: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: BorderRadius['2xl'],
  },
  streakNumber: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  streakLabel: {
    marginTop: Spacing.xs,
  },
  workoutCard: {
    marginBottom: Spacing.lg,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  phaseLabel: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  workoutTitle: {
    marginBottom: Spacing.xs,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  phaseDescription: {
    marginBottom: Spacing.lg,
  },
  segmentsList: {
    marginBottom: Spacing.lg,
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  segmentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.sm,
  },
  startButton: {
    marginTop: Spacing.sm,
  },
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  recoveryCard: {
    marginBottom: Spacing.lg,
  },
  recoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recoveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recoveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  recoveryText: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  statValue: {
    fontWeight: '600',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
});
