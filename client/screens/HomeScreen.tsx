import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { ANIM_DURATION_CONTENT, ANIM_DELAY_SHORT, ANIM_DELAY_MED, ANIM_DELAY_LONG, ANIM_DELAY_XL } from '@/constants/animation';
import { storage, UserSettings, UserProgress, defaultSettings } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import {
  getTodaysWorkout,
  getWorkoutForRecoveryMode,
  getScheduledDaysForWeek,
  getWorkoutCompletionsForWeek,
  DayTemplate,
  Week,
} from '@/data/workoutProgram';
import { trackWeekComplete } from '@/lib/analytics';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { fontScale, colors, highContrast } = useAccessibility();
  const { hasAccess, isTrialActive, trialDaysRemaining } = useSubscription();
  const { cp, isDarkMode } = useThemePreference();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [todaysWorkout, setTodaysWorkout] = useState<{
    week: Week;
    dayIndex: number;
    workout: DayTemplate;
    isRestDay: boolean;
  } | null>(null);
  const [isTodayComplete, setIsTodayComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [weeklyReviewData, setWeeklyReviewData] = useState<{
    weekNumber: number;
    daysWorkedOut: number;
  } | null>(null);
  const [pendingReviewMessage, setPendingReviewMessage] = useState<string>('');
  const trackedWeekCompleteRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    const startDate = await storage.getProgramStartDate();

    await storage.backfillRestDays(startDate);

    const [userProgress, userSettings] = await Promise.all([
      storage.getProgress(),
      storage.getSettings(),
    ]);
    
    setProgress(userProgress);
    setSettings(userSettings);
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setIsTodayComplete(userProgress.completedDates.includes(todayStr));

    const workout = getTodaysWorkout(userProgress.completedDates, startDate || undefined);
    setTodaysWorkout(workout);
    
    const reviewCheck = await storage.shouldShowWeeklyReview(userProgress.completedDates, startDate);
    if (reviewCheck.show) {
      const scheduledDays = getScheduledDaysForWeek(reviewCheck.weekNumber);
      const workoutCompletions = startDate
        ? getWorkoutCompletionsForWeek(userProgress.completedDates, reviewCheck.weekNumber, startDate)
        : 0;

      setWeeklyReviewData({
        weekNumber: reviewCheck.weekNumber,
        daysWorkedOut: reviewCheck.daysWorkedOut,
      });
      setShowWeeklyReview(true);

      if (
        scheduledDays > 0 &&
        workoutCompletions >= scheduledDays &&
        trackedWeekCompleteRef.current !== reviewCheck.weekNumber
      ) {
        const lastTracked = await storage.getLastWeekCompleteTracked();
        if (lastTracked !== reviewCheck.weekNumber) {
          trackedWeekCompleteRef.current = reviewCheck.weekNumber;
          await storage.setLastWeekCompleteTracked(reviewCheck.weekNumber);
          trackWeekComplete({
            weekNumber: reviewCheck.weekNumber,
            daysWorkedOut: workoutCompletions,
            scheduledDays,
          });
        } else {
          trackedWeekCompleteRef.current = reviewCheck.weekNumber;
        }
      }
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

  const navigateToTrialExpired = async () => {
    try {
      const seen = await AsyncStorage.getItem('pulsekegel_challenge_shown');
      if (!seen) {
        await AsyncStorage.setItem('pulsekegel_challenge_shown', 'true');
        navigation.navigate('Week1Review');
      } else {
        navigation.navigate('Paywall');
      }
    } catch {
      navigation.navigate('Paywall');
    }
  };

  const handleStartWorkout = async () => {
    if (!todaysWorkout) return;
    
    if (!hasAccess) {
      await navigateToTrialExpired();
      return;
    }
    
    const workout = settings.recoveryMode
      ? getWorkoutForRecoveryMode(todaysWorkout.workout)
      : todaysWorkout.workout;
    
    navigation.navigate('WorkoutPlayer', {
      workout,
      weekNumber: todaysWorkout.week.weekNumber,
      phase: todaysWorkout.week.phase,
      dayNumber: todaysWorkout.dayIndex + 1,
    });
  };

  const handleQuickWorkout = async () => {
    if (!hasAccess) {
      await navigateToTrialExpired();
      return;
    }
    navigation.navigate('WorkoutPicker');
  };

  const handleWeeklyReviewClose = async () => {
    if (weeklyReviewData && pendingReviewMessage) {
      await storage.saveWeeklyReviewToHistory({
        weekNumber: weeklyReviewData.weekNumber,
        daysWorkedOut: weeklyReviewData.daysWorkedOut,
        totalMinutes: progress?.totalMinutes || 0,
        message: pendingReviewMessage,
        date: new Date().toISOString().split('T')[0],
      });
      await storage.setLastWeeklyReview(weeklyReviewData.weekNumber);
    }
    setShowWeeklyReview(false);
    setWeeklyReviewData(null);
    setPendingReviewMessage('');
  };

  const formatLastCompleted = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    if (dateStr === formatLocalDate(today)) {
      return 'Today';
    } else if (dateStr === formatLocalDate(yesterday)) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <LinearGradient
      colors={cp.gradient as unknown as [string, string, ...string[]]}
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
            tintColor={cp.neonGreen}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_SHORT)}>
          <View style={styles.streakContainer}>
            <View style={[styles.streakBadge, { backgroundColor: `${cp.neonGreen}1A`, borderColor: `${cp.neonGreen}4D` }, highContrast && { borderColor: colors.border }]}>
              <Feather name="zap" size={24 * fontScale} color={colors.accent} />
              <Text style={[styles.streakNumber, { fontSize: 48 * fontScale, color: cp.neonGreen, textShadowColor: isDarkMode ? cp.neonGreen : 'transparent' }]}>
                {progress?.currentStreak || 0}
              </Text>
              <Text style={[styles.streakLabel, { fontSize: 14 * fontScale, color: cp.textSecondary }]}>
                Day Streak
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_MED)}>
          <View style={[styles.card, { backgroundColor: cp.cardBg, borderColor: isTodayComplete && !todaysWorkout?.isRestDay ? `${cp.neonGreen}4D` : cp.cardBorder }]}>
            {todaysWorkout ? (
              todaysWorkout.isRestDay ? (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={[styles.phaseLabel, { fontSize: 14 * fontScale, color: colors.accentSecondary, textShadowColor: isDarkMode ? cp.neonCyan : 'transparent' }]}>
                        Week {todaysWorkout.week.weekNumber} - {todaysWorkout.week.phase}
                      </Text>
                      <Text style={[styles.workoutTitle, { fontSize: 24 * fontScale, color: cp.text }]}>
                        Rest Day
                      </Text>
                    </View>
                    <View style={[styles.durationBadge, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                      <Feather name="moon" size={14} color={cp.neonPurple} />
                      <Text style={[styles.durationText, { color: cp.neonPurple }]}>
                        Recovery
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.phaseDescription, { color: cp.textSecondary }]}>
                    Take today to recover. Your muscles grow stronger during rest!
                  </Text>

                  <View style={styles.restDayContent}>
                    <View style={styles.restDayIcon}>
                      <Feather name="battery-charging" size={32} color={cp.neonPurple} />
                    </View>
                    <Text style={[styles.restDayMessage, { color: cp.textSecondary }]}>
                      Rest days are essential for muscle recovery and preventing overtraining. Your pelvic floor is building strength from your previous workouts.
                    </Text>
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable onPress={() => navigation.navigate('BreathworkModeSelector')} style={styles.startButtonContainer} testID="breathwork-button">
                      <LinearGradient
                        colors={['#00B4C5', '#0090A0']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Feather name="wind" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.startButtonText, { fontSize: 16 * fontScale }]}>Breathwork Session</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable onPress={handleQuickWorkout} style={styles.startButtonContainer}>
                      <LinearGradient
                        colors={[cp.neonPurple, cp.neonPink]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Text style={[styles.startButtonText, { fontSize: 16 * fontScale }]}>Optional Quick Workout</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              ) : isTodayComplete ? (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={[styles.phaseLabel, { fontSize: 14 * fontScale, color: colors.accentSecondary, textShadowColor: isDarkMode ? cp.neonCyan : 'transparent' }]}>
                        Week {todaysWorkout.week.weekNumber} - {todaysWorkout.week.phase}
                      </Text>
                      <Text style={[styles.workoutTitle, { fontSize: 24 * fontScale, color: cp.text }]}>
                        {todaysWorkout.workout.name}
                      </Text>
                    </View>
                    <View style={[styles.durationBadge, { backgroundColor: `${cp.neonGreen}26`, borderColor: `${cp.neonGreen}4D`, borderWidth: 1 }]}>
                      <Feather name="check-circle" size={14} color={cp.neonGreen} />
                      <Text style={[styles.durationText, { color: cp.neonGreen }]}>
                        Complete
                      </Text>
                    </View>
                  </View>

                  <View style={styles.completionPanel}>
                    <View style={[styles.completionIconCircle, { backgroundColor: `${cp.neonGreen}1A`, borderColor: `${cp.neonGreen}33` }]}>
                      <Feather name="check" size={36} color={cp.neonGreen} />
                    </View>
                    <Text style={[styles.completionHeading, { fontSize: 22 * fontScale, color: cp.neonGreen, textShadowColor: isDarkMode ? cp.neonGreen : 'transparent' }]}>
                      Today's Complete!
                    </Text>
                    <Text style={[styles.completionSubtext, { color: cp.textSecondary }]}>
                      Great work. Your pelvic floor is getting stronger every session.
                    </Text>
                  </View>

                  <View style={styles.completionActions}>
                    <Pressable onPress={handleQuickWorkout} style={[styles.secondaryActionButton, { backgroundColor: `${cp.neonCyan}1A`, borderColor: `${cp.neonCyan}4D` }]}>
                      <Feather name="zap" size={16} color={cp.neonCyan} />
                      <Text style={[styles.secondaryActionText, { color: cp.neonCyan }]}>Quick Workout</Text>
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('BreathworkModeSelector')} style={[styles.secondaryActionButton, { backgroundColor: 'rgba(0,180,197,0.1)', borderColor: 'rgba(0,180,197,0.3)' }]} testID="breathwork-button">
                      <Feather name="wind" size={16} color="#00B4C5" />
                      <Text style={[styles.secondaryActionText, { color: '#00B4C5' }]}>Breathwork</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={[styles.phaseLabel, { fontSize: 14 * fontScale, color: colors.accentSecondary, textShadowColor: isDarkMode ? cp.neonCyan : 'transparent' }]}>
                        Week {todaysWorkout.week.weekNumber} - {todaysWorkout.week.phase}
                      </Text>
                      <Text style={[styles.workoutTitle, { fontSize: 24 * fontScale, color: cp.text }]}>
                        {todaysWorkout.workout.name}
                      </Text>
                    </View>
                    <View style={[styles.durationBadge, { backgroundColor: cp.cardBorder }]}>
                      <Feather name="clock" size={14} color={cp.textSecondary} />
                      <Text style={[styles.durationText, { color: cp.textSecondary }]}>
                        {settings.recoveryMode
                          ? getWorkoutForRecoveryMode(todaysWorkout.workout).estimatedMinutes
                          : todaysWorkout.workout.estimatedMinutes}{' '}
                        min
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.phaseDescription, { color: cp.textSecondary }]}>
                    {todaysWorkout.week.phaseDescription}
                  </Text>

                  <View style={styles.segmentsList}>
                    {(settings.recoveryMode
                      ? getWorkoutForRecoveryMode(todaysWorkout.workout)
                      : todaysWorkout.workout
                    ).segments.map((segment) => (
                      <View key={segment.id} style={styles.segmentItem}>
                        <View style={[styles.segmentDot, { backgroundColor: cp.neonGreen }]} />
                        <Text style={[styles.segmentText, { color: cp.textSecondary }]}>
                          {segment.name} ({segment.sets}x{segment.repsPerSet})
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.buttonsRow}>
                    <Pressable onPress={handleStartWorkout} style={[styles.startButtonContainer, { shadowColor: isDarkMode ? cp.neonGreen : 'transparent' }]}>
                      <LinearGradient
                        colors={[cp.neonGreen, cp.neonCyan]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.startButton}
                      >
                        <Text style={[styles.startButtonText, { fontSize: 16 * fontScale }]}>Start Program</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable onPress={handleQuickWorkout} style={[styles.quickWorkoutButton, { backgroundColor: `${cp.neonCyan}1A`, borderColor: `${cp.neonCyan}4D` }]}>
                      <Feather name="zap" size={18} color={cp.neonCyan} />
                      <Text style={[styles.quickWorkoutText, { color: cp.neonCyan }]}>Quick</Text>
                    </Pressable>
                  </View>

                  <Pressable onPress={() => navigation.navigate('BreathworkModeSelector')} style={styles.breathworkLink} testID="breathwork-button">
                    <Feather name="wind" size={16} color="#00B4C5" />
                    <Text style={[styles.breathworkLinkText, { color: '#00B4C5' }]}>Breathwork Session</Text>
                    <Feather name="chevron-right" size={16} color="#00B4C5" />
                  </Pressable>
                </>
              )
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: cp.textSecondary }]}>Loading workout...</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_LONG)}>
          <View style={[styles.card, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
            <View style={styles.recoveryHeader}>
              <View style={styles.recoveryInfo}>
                <View style={[styles.recoveryIcon, { backgroundColor: `${cp.neonPurple}26` }]}>
                  <Feather name="heart" size={20} color={cp.neonPurple} />
                </View>
                <View style={styles.recoveryText}>
                  <Text style={[styles.recoveryTitle, { color: cp.text }]}>
                    Recovery Mode
                  </Text>
                  <Text style={[styles.recoverySubtitle, { color: cp.textSecondary }]}>
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

        <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_XL)}>
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
              <Feather name="check-circle" size={18} color={cp.neonGreen} />
              <Text style={[styles.statValue, { color: cp.text }]}>
                {progress?.totalSessions || 0}
              </Text>
              <Text style={[styles.statLabel, { color: cp.textSecondary }]}>
                Sessions
              </Text>
            </View>
            
            <View style={[styles.statItem, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
              <Feather name="clock" size={18} color={cp.neonCyan} />
              <Text style={[styles.statValue, { color: cp.text }]}>
                {progress?.totalMinutes || 0}
              </Text>
              <Text style={[styles.statLabel, { color: cp.textSecondary }]}>
                Minutes
              </Text>
            </View>
            
            <View style={[styles.statItem, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
              <Feather name="calendar" size={18} color={cp.neonCyan} />
              <Text style={[styles.statValue, { color: cp.text }]}>
                {formatLastCompleted(progress?.lastCompletedDate || null)}
              </Text>
              <Text style={[styles.statLabel, { color: cp.textSecondary }]}>
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
        currentStreak={progress?.currentStreak ?? 0}
        onMessageReady={setPendingReviewMessage}
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
    borderWidth: 1,
  },
  streakNumber: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
    marginTop: Spacing.sm,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  streakLabel: {
    marginTop: Spacing.xs,
    fontSize: 14,
  },
  card: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
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
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  workoutTitle: {
    marginBottom: Spacing.xs,
    fontSize: 24,
    fontWeight: '600',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  durationText: {
    marginLeft: Spacing.xs,
    fontSize: 14,
  },
  phaseDescription: {
    marginBottom: Spacing.lg,
    fontSize: 14,
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
  },
  segmentText: {
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
    borderWidth: 1,
  },
  quickWorkoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  breathworkLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  breathworkLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  loadingText: {
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
  },
  recoveryText: {
    flex: 1,
  },
  recoveryTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  recoverySubtitle: {
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
    borderWidth: 1,
  },
  statValue: {
    fontWeight: '600',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    fontSize: 16,
  },
  statLabel: {
    fontSize: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completionPanel: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  completionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  completionHeading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  completionSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  completionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
