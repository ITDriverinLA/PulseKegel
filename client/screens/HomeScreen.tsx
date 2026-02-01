import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Toggle } from '@/components/Toggle';
import { WeeklyReviewModal } from '@/components/WeeklyReviewModal';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, UserSettings, UserProgress, defaultSettings } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import {
  getTodaysWorkout,
  getWorkoutForRecoveryMode,
  DayTemplate,
  Week,
} from '@/data/workoutProgram';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';
const NEON_PURPLE = '#9D4EDD';
const DARK_GRADIENT = ['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a'] as const;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { fontScale, colors, highContrast } = useAccessibility();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [todaysWorkout, setTodaysWorkout] = useState<{
    week: Week;
    dayIndex: number;
    workout: DayTemplate;
    isRestDay: boolean;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [weeklyReviewData, setWeeklyReviewData] = useState<{
    weekNumber: number;
    daysWorkedOut: number;
  } | null>(null);

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
    
    const reviewCheck = await storage.shouldShowWeeklyReview(userProgress.completedDates, startDate);
    if (reviewCheck.show) {
      setWeeklyReviewData({
        weekNumber: reviewCheck.weekNumber,
        daysWorkedOut: reviewCheck.daysWorkedOut,
      });
      setShowWeeklyReview(true);
    }
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

  const handleQuickWorkout = () => {
    navigation.navigate('WorkoutPicker');
  };

  const handleWeeklyReviewClose = async () => {
    if (weeklyReviewData) {
      await storage.setLastWeeklyReview(weeklyReviewData.weekNumber);
    }
    setShowWeeklyReview(false);
    setWeeklyReviewData(null);
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
    <LinearGradient
      colors={DARK_GRADIENT}
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
            tintColor={NEON_GREEN}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={styles.streakContainer}>
            <View style={[styles.streakBadge, highContrast && { borderColor: colors.border }]}>
              <Feather name="zap" size={24 * fontScale} color={colors.accent} />
              <Text style={[styles.streakNumber, { fontSize: 48 * fontScale, color: colors.text }]}>
                {progress?.currentStreak || 0}
              </Text>
              <Text style={[styles.streakLabel, { fontSize: 14 * fontScale, color: colors.textSecondary }]}>
                Day Streak
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <View style={styles.card}>
            {todaysWorkout ? (
              todaysWorkout.isRestDay ? (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={[styles.phaseLabel, { fontSize: 14 * fontScale, color: colors.accentSecondary }]}>
                        Week {todaysWorkout.week.weekNumber} - {todaysWorkout.week.phase}
                      </Text>
                      <Text style={[styles.workoutTitle, { fontSize: 24 * fontScale, color: colors.text }]}>
                        Rest Day
                      </Text>
                    </View>
                    <View style={[styles.durationBadge, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                      <Feather name="moon" size={14} color={NEON_PURPLE} />
                      <Text style={[styles.durationText, { color: NEON_PURPLE }]}>
                        Recovery
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.phaseDescription}>
                    Take today to recover. Your muscles grow stronger during rest!
                  </Text>

                  <View style={styles.restDayContent}>
                    <View style={styles.restDayIcon}>
                      <Feather name="battery-charging" size={32} color={NEON_PURPLE} />
                    </View>
                    <Text style={styles.restDayMessage}>
                      Rest days are essential for muscle recovery and preventing overtraining. 
                      Your pelvic floor is building strength from your previous workouts.
                    </Text>
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable onPress={handleQuickWorkout} style={styles.startButtonContainer}>
                      <LinearGradient
                        colors={[NEON_PURPLE, NEON_PINK]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Text style={[styles.startButtonText, { fontSize: 16 * fontScale }]}>Optional Quick Workout</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={[styles.phaseLabel, { fontSize: 14 * fontScale, color: colors.accentSecondary }]}>
                        Week {todaysWorkout.week.weekNumber} - {todaysWorkout.week.phase}
                      </Text>
                      <Text style={[styles.workoutTitle, { fontSize: 24 * fontScale, color: colors.text }]}>
                        {todaysWorkout.workout.name}
                      </Text>
                    </View>
                    <View style={styles.durationBadge}>
                      <Feather name="clock" size={14} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.durationText}>
                        {settings.recoveryMode
                          ? getWorkoutForRecoveryMode(todaysWorkout.workout).estimatedMinutes
                          : todaysWorkout.workout.estimatedMinutes}{' '}
                        min
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.phaseDescription}>
                    {todaysWorkout.week.phaseDescription}
                  </Text>

                  <View style={styles.segmentsList}>
                    {(settings.recoveryMode
                      ? getWorkoutForRecoveryMode(todaysWorkout.workout)
                      : todaysWorkout.workout
                    ).segments.map((segment) => (
                      <View key={segment.id} style={styles.segmentItem}>
                        <View style={styles.segmentDot} />
                        <Text style={styles.segmentText}>
                          {segment.name} ({segment.sets}x{segment.repsPerSet})
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable onPress={handleStartWorkout} style={styles.startButtonContainer}>
                      <LinearGradient
                        colors={[NEON_GREEN, NEON_CYAN]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Text style={[styles.startButtonText, { fontSize: 16 * fontScale }]}>Start Program</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable onPress={handleQuickWorkout} style={styles.quickWorkoutButton}>
                      <Feather name="zap" size={18} color={NEON_CYAN} />
                      <Text style={styles.quickWorkoutText}>Quick</Text>
                    </Pressable>
                  </View>
                </>
              )
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading workout...</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View style={styles.card}>
            <View style={styles.recoveryHeader}>
              <View style={styles.recoveryInfo}>
                <View style={styles.recoveryIcon}>
                  <Feather name="heart" size={20} color={NEON_PURPLE} />
                </View>
                <View style={styles.recoveryText}>
                  <Text style={styles.recoveryTitle}>
                    Recovery Mode
                  </Text>
                  <Text style={styles.recoverySubtitle}>
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

        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="check-circle" size={18} color={NEON_GREEN} />
              <Text style={styles.statValue}>
                {progress?.totalSessions || 0}
              </Text>
              <Text style={styles.statLabel}>
                Sessions
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Feather name="clock" size={18} color={NEON_CYAN} />
              <Text style={styles.statValue}>
                {progress?.totalMinutes || 0}
              </Text>
              <Text style={styles.statLabel}>
                Minutes
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Feather name="calendar" size={18} color={NEON_CYAN} />
              <Text style={styles.statValue}>
                {formatLastCompleted(progress?.lastCompletedDate || null)}
              </Text>
              <Text style={styles.statLabel}>
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
  streakContainer: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  streakBadge: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: BorderRadius['2xl'],
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  streakNumber: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
    marginTop: Spacing.sm,
    color: NEON_GREEN,
    textShadowColor: NEON_GREEN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  streakLabel: {
    marginTop: Spacing.xs,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  card: {
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: Spacing.lg,
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
    fontSize: 14,
    color: NEON_CYAN,
    textShadowColor: NEON_CYAN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  workoutTitle: {
    marginBottom: Spacing.xs,
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  durationText: {
    color: 'rgba(255,255,255,0.6)',
    marginLeft: Spacing.xs,
    fontSize: 14,
  },
  phaseDescription: {
    marginBottom: Spacing.lg,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  restDayContent: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  restDayIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  restDayMessage: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.7)',
    paddingHorizontal: Spacing.md,
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
    backgroundColor: NEON_GREEN,
  },
  segmentText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  startButtonContainer: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  startButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  startButtonText: {
    color: '#0a0a1a',
    fontSize: 16,
    fontWeight: '700',
  },
  quickWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  quickWorkoutText: {
    color: NEON_CYAN,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
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
    backgroundColor: 'rgba(157, 78, 221, 0.15)',
  },
  recoveryText: {
    flex: 1,
  },
  recoveryTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: '#fff',
  },
  recoverySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    fontWeight: '600',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    fontSize: 16,
    color: '#fff',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
});
