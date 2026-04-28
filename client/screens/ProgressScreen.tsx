import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Image, RefreshControl, ScrollView, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { ProgressStackParamList } from '@/navigation/ProgressStackNavigator';

import { StatCard } from '@/components/StatCard';
import { CalendarGrid } from '@/components/CalendarGrid';
import { WeeklyReviewModal } from '@/components/WeeklyReviewModal';
import { BadgesSection } from '@/components/BadgesSection';
import { Spacing, BorderRadius } from '@/constants/theme';
import {
  ANIM_DURATION_CONTENT,
  ANIM_DELAY_SHORT,
  ANIM_DELAY_MED,
  ANIM_DELAY_LONG,
  ANIM_DELAY_320,
  ANIM_DELAY_350,
  ANIM_DELAY_XL,
  ANIM_DELAY_450,
} from '@/constants/animation';
import { storage, UserProgress } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<ProgressStackParamList>>();
  const { fontScale, colors, highContrast } = useAccessibility();
  const { cp, isDarkMode } = useThemePreference();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [restDates, setRestDates] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [missedWeeks, setMissedWeeks] = useState<number[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewWeekNumber, setReviewWeekNumber] = useState(1);
  const [reviewDaysWorkedOut, setReviewDaysWorkedOut] = useState(0);
  const [reviewTotalMinutes, setReviewTotalMinutes] = useState(0);
  const [pendingReviewMessage, setPendingReviewMessage] = useState('');
  const [hasReviewHistory, setHasReviewHistory] = useState(false);
  const [settings, setSettings] = useState<{ anatomyType: 'male' | 'female' | null; userName: string }>({ anatomyType: null, userName: '' });

  const loadData = useCallback(async () => {
    const startDate = await storage.getProgramStartDate();
    await storage.backfillRestDays(startDate);
    const [userProgress, userRestDates, userSettings] = await Promise.all([
      storage.getProgress(),
      storage.getRestDates(),
      storage.getSettings(),
    ]);
    setProgress(userProgress);
    setRestDates(userRestDates);
    setSettings({ anatomyType: userSettings.anatomyType, userName: userSettings.userName });

    const missed = await storage.getMissedWeeklyReviews(userProgress.completedDates, startDate);
    setMissedWeeks(missed);

    const history = await storage.getReviewHistory();
    setHasReviewHistory(history.length > 0);
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

  const handleViewReview = async (weekNumber: number) => {
    const startDate = await storage.getProgramStartDate();
    if (!startDate || !progress) return;
    const data = await storage.getWeeklyReviewDataForWeek(weekNumber, progress.completedDates, startDate);
    setReviewWeekNumber(weekNumber);
    setReviewDaysWorkedOut(data.daysWorkedOut);
    setReviewTotalMinutes(progress.totalMinutes);
    setShowReviewModal(true);
  };

  const handleReviewClose = async () => {
    if (pendingReviewMessage) {
      await storage.saveWeeklyReviewToHistory({
        weekNumber: reviewWeekNumber,
        daysWorkedOut: reviewDaysWorkedOut,
        totalMinutes: reviewTotalMinutes,
        message: pendingReviewMessage,
        date: new Date().toISOString().split('T')[0],
      });
      setHasReviewHistory(true);
    }
    const remaining = missedWeeks.filter(w => w !== reviewWeekNumber).sort((a, b) => a - b);
    const highestConsecutive = remaining.length > 0 ? Math.min(reviewWeekNumber, remaining[0] - 1) : reviewWeekNumber;
    const lastReviewed = await storage.getLastWeeklyReview();
    if (lastReviewed === null || highestConsecutive > lastReviewed) {
      await storage.setLastWeeklyReview(highestConsecutive);
    }
    setShowReviewModal(false);
    setMissedWeeks(remaining);
    setPendingReviewMessage('');
  };

  const hasProgress = progress && progress.completedDates.length > 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
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
            tintColor={cp.neonCyan}
          />
        }
      >
        {hasProgress ? (
          <>
            <Animated.View
              entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_SHORT)}
              style={styles.statsContainer}
            >
              <StatCard
                icon="zap"
                label="Current Streak"
                value={progress.currentStreak}
                color={cp.neonGreen}
              />
              <View style={{ width: Spacing.sm }} />
              <StatCard
                icon="check-circle"
                label="Total Sessions"
                value={progress.totalSessions}
                color={cp.neonCyan}
              />
              <View style={{ width: Spacing.sm }} />
              <StatCard
                icon="clock"
                label="Total Minutes"
                value={progress.totalMinutes}
                color={cp.neonPink}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_MED)}>
              <CalendarGrid
                completedDates={progress.completedDates}
                restDates={restDates}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
              />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_LONG)}
              style={styles.programButtonContainer}
            >
              <Pressable
                style={[styles.programButton, { backgroundColor: cp.cardBg, borderColor: `${cp.neonCyan}26` }]}
                onPress={() => navigation.navigate('ProgramOverview')}
                testID="button-view-program"
              >
                <View style={styles.programButtonLeft}>
                  <View style={[styles.programButtonIcon, { backgroundColor: cp.cardBorder }]}>
                    <Feather name="layers" size={18} color={cp.neonCyan} />
                  </View>
                  <View>
                    <Text style={[styles.programButtonTitle, { fontSize: 14 * fontScale, color: cp.text }]}>
                      12-Week Program
                    </Text>
                    <Text style={[styles.programButtonSubtitle, { color: cp.textMuted }]}>
                      Preview schedule & track progress
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={cp.textMuted} />
              </Pressable>
            </Animated.View>

            {hasReviewHistory ? (
              <Animated.View
                entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_320)}
                style={{ marginTop: Spacing.sm }}
              >
                <Pressable
                  style={[styles.programButton, { backgroundColor: cp.cardBg, borderColor: `${cp.neonCyan}26` }]}
                  onPress={() => navigation.navigate('ReviewHistory')}
                  testID="button-review-history"
                >
                  <View style={styles.programButtonLeft}>
                    <View style={[styles.programButtonIcon, { backgroundColor: `${cp.neonPurple}1A` }]}>
                      <Feather name="book-open" size={18} color={cp.neonPurple} />
                    </View>
                    <View>
                      <Text style={[styles.programButtonTitle, { fontSize: 14 * fontScale, color: cp.text }]}>
                        AI Review History
                      </Text>
                      <Text style={[styles.programButtonSubtitle, { color: cp.textMuted }]}>
                        Reread past tips & insights
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={cp.textMuted} />
                </Pressable>
              </Animated.View>
            ) : null}

            {missedWeeks.length > 0 ? (
              <Animated.View
                entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_350)}
                style={styles.missedReviewsContainer}
              >
                <Text style={[styles.missedReviewsTitle, { fontSize: 13 * fontScale, color: cp.neonPurple }]}>
                  Missed AI Reviews
                </Text>
                {missedWeeks.map((week) => (
                  <Pressable
                    key={week}
                    style={[styles.missedReviewButton, { backgroundColor: `${cp.neonPurple}0F`, borderColor: `${cp.neonPurple}33` }]}
                    onPress={() => handleViewReview(week)}
                    testID={`button-missed-review-week-${week}`}
                  >
                    <View style={styles.programButtonLeft}>
                      <View style={[styles.programButtonIcon, { backgroundColor: `${cp.neonPurple}26` }]}>
                        <Feather name="message-circle" size={16} color={cp.neonPurple} />
                      </View>
                      <View>
                        <Text style={[styles.programButtonTitle, { fontSize: 13 * fontScale, color: cp.text }]}>
                          Week {week} Review
                        </Text>
                        <Text style={[styles.programButtonSubtitle, { color: cp.textMuted }]}>
                          Tap to view your AI progress update
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.missedBadge, { backgroundColor: cp.neonPurple }]}>
                      <Text style={[styles.missedBadgeText, { color: cp.text }]}>NEW</Text>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_XL)}>
              <BadgesSection />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(ANIM_DELAY_450)}
              style={styles.longestStreakContainer}
            >
              <View style={[styles.longestStreakCard, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }, highContrast && { borderColor: colors.border }]}>
                <Text style={[styles.longestStreakLabel, { fontSize: 12 * fontScale, color: colors.textSecondary }]}>
                  Longest Streak
                </Text>
                <Text style={[styles.longestStreakValue, { fontSize: 20 * fontScale, color: colors.accent }]}>
                  {progress.longestStreak} {progress.longestStreak === 1 ? 'day' : 'days'}
                </Text>
              </View>
            </Animated.View>
          </>
        ) : (
          <Animated.View
            entering={FadeInDown.duration(ANIM_DURATION_CONTENT)}
            style={styles.emptyContainer}
          >
            <Image
              source={require('../../assets/images/empty-progress.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={[styles.emptyTitle, { color: cp.text }]}>
              Start Your Journey
            </Text>
            <Text style={[styles.emptyDescription, { color: cp.textSecondary }]}>
              Complete your first workout to begin tracking your progress here.
            </Text>

            <Pressable
              style={[styles.programButton, { marginTop: Spacing.xl, backgroundColor: cp.cardBg, borderColor: `${cp.neonCyan}26` }]}
              onPress={() => navigation.navigate('ProgramOverview')}
              testID="button-view-program-empty"
            >
              <View style={styles.programButtonLeft}>
                <View style={[styles.programButtonIcon, { backgroundColor: cp.cardBorder }]}>
                  <Feather name="layers" size={18} color={cp.neonCyan} />
                </View>
                <View>
                  <Text style={[styles.programButtonTitle, { fontSize: 14 * fontScale, color: cp.text }]}>
                    Preview 12-Week Program
                  </Text>
                  <Text style={[styles.programButtonSubtitle, { color: cp.textMuted }]}>
                    See what's ahead
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={cp.textMuted} />
            </Pressable>

            <BadgesSection />
          </Animated.View>
        )}
      </ScrollView>

      <WeeklyReviewModal
        visible={showReviewModal}
        onClose={handleReviewClose}
        weekNumber={reviewWeekNumber}
        daysWorkedOut={reviewDaysWorkedOut}
        totalMinutes={progress?.totalMinutes || 0}
        anatomyType={settings.anatomyType}
        userName={settings.userName}
        onMessageReady={setPendingReviewMessage}
      />
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
    borderWidth: 1,
  },
  longestStreakLabel: {
    fontSize: 12,
  },
  longestStreakValue: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  missedReviewsContainer: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  missedReviewsTitle: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  missedReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  missedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  missedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  programButtonContainer: {
    marginTop: Spacing.lg,
  },
  programButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  programButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  programButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programButtonTitle: {
    fontWeight: '600',
  },
  programButtonSubtitle: {
    fontSize: 11,
    marginTop: 1,
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
  },
  emptyDescription: {
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 16,
  },
});
