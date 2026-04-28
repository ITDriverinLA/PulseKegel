import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Text, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { Spacing, BorderRadius } from '@/constants/theme';
import { ANIM_DURATION_ENTER, ANIM_DELAY_SHORT, ANIM_DELAY_STAGGER_SM } from '@/constants/animation';
import { storage, WeeklyReviewEntry } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';

export default function ReviewHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { fontScale, colors, highContrast } = useAccessibility();
  const { cp, isDarkMode } = useThemePreference();

  function getPhaseForWeek(week: number): { name: string; color: string } {
    if (week === 0) return { name: 'Trial Week', color: cp.neonPurple };
    if (week <= 2) return { name: 'Control Phase', color: cp.neonCyan };
    if (week <= 6) return { name: 'Strength Phase', color: cp.neonGreen };
    if (week <= 10) return { name: 'Power Phase', color: cp.neonPink };
    return { name: 'Maintenance Phase', color: cp.neonPurple };
  }

  function getAccentForDays(days: number): string {
    if (days >= 5) return cp.neonGreen;
    if (days >= 3) return cp.neonCyan;
    return cp.neonPurple;
  }

  const [reviews, setReviews] = useState<WeeklyReviewEntry[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadReviews = useCallback(async () => {
    const history = await storage.getReviewHistory();
    setReviews(history.sort((a, b) => b.weekNumber - a.weekNumber));
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  }, [loadReviews]);

  const toggleExpanded = (weekNumber: number) => {
    setExpandedWeek(prev => prev === weekNumber ? null : weekNumber);
  };

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
          paddingBottom: insets.bottom + Spacing.xl,
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
        {reviews.length > 0 ? (
          <>
            <Animated.View entering={FadeInDown.duration(ANIM_DURATION_ENTER)}>
              <Text style={[styles.headerSubtitle, { color: cp.textMuted, fontSize: 13 * fontScale }]}>
                Your personalized AI insights from each completed week
              </Text>
            </Animated.View>

            {reviews.map((review, index) => {
              const phase = getPhaseForWeek(review.weekNumber);
              const accent = getAccentForDays(review.daysWorkedOut);
              const isExpanded = expandedWeek === review.weekNumber;

              return (
                <Animated.View
                  key={review.weekNumber}
                  entering={FadeInDown.duration(ANIM_DURATION_ENTER).delay(ANIM_DELAY_SHORT + index * ANIM_DELAY_STAGGER_SM)}
                >
                  <Pressable
                    style={[
                      styles.reviewCard,
                      { backgroundColor: cp.cardBg, borderColor: cp.inputBg },
                      isExpanded && { borderColor: cp.neonPurple + '25', backgroundColor: cp.neonPurple + '04' },
                      highContrast && { borderColor: colors.border },
                    ]}
                    onPress={() => toggleExpanded(review.weekNumber)}
                    testID={`review-card-week-${review.weekNumber}`}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.weekBadge, { backgroundColor: `${accent}20` }]}>
                          <Text style={[styles.weekBadgeText, { color: accent, fontSize: 12 * fontScale }]}>
                            {review.weekNumber === 0 ? 'T1' : `W${review.weekNumber}`}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.cardTitle, { color: cp.text, fontSize: 15 * fontScale }]}>
                            {review.weekNumber === 0 ? 'Trial Week' : `Week ${review.weekNumber}`}
                          </Text>
                          <Text style={[styles.phaseLabel, { color: phase.color, fontSize: 11 * fontScale }]}>
                            {phase.name}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.cardHeaderRight}>
                        <View style={styles.miniStats}>
                          <View style={styles.miniStat}>
                            <Feather name="zap" size={12} color={accent} />
                            <Text style={[styles.miniStatText, { color: accent }]}>
                              {review.daysWorkedOut}d
                            </Text>
                          </View>
                        </View>
                        <Feather
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={cp.textMuted}
                        />
                      </View>
                    </View>

                    {isExpanded ? (
                      <View style={[styles.expandedContent, { borderTopColor: cp.divider }]}>
                        <View style={styles.statsRow}>
                          <View style={[styles.statPill, { borderColor: `${accent}30` }]}>
                            <Feather name="calendar" size={14} color={accent} />
                            <Text style={[styles.statPillText, { color: cp.textSecondary, fontSize: 12 * fontScale }]}>
                              {review.daysWorkedOut} days active
                            </Text>
                          </View>
                          <View style={[styles.statPill, { borderColor: `${accent}30` }]}>
                            <Feather name="activity" size={14} color={accent} />
                            <Text style={[styles.statPillText, { color: cp.textSecondary, fontSize: 12 * fontScale }]}>
                              {review.totalMinutes} min
                            </Text>
                          </View>
                          <View style={[styles.statPill, { borderColor: cp.cardBorder }]}>
                            <Feather name="clock" size={14} color={cp.textSecondary} />
                            <Text style={[styles.statPillText, { color: cp.textSecondary, fontSize: 12 * fontScale }]}>
                              {review.date}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.messageContainer, { backgroundColor: cp.neonPurple + '06', borderColor: cp.neonPurple + '12' }]}>
                          <View style={styles.messageHeader}>
                            <Feather name="cpu" size={14} color={cp.neonPurple} />
                            <Text style={[styles.messageHeaderText, { color: cp.neonPurple, fontSize: 11 * fontScale }]}>
                              AI Insight
                            </Text>
                          </View>
                          <Text style={[styles.messageText, { color: cp.textSecondary, fontSize: 14 * fontScale, lineHeight: 22 * fontScale }]}>
                            {review.message}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="book-open" size={48} color={cp.textMuted} />
            <Text style={[styles.emptyTitle, { color: cp.text, fontSize: 18 * fontScale }]}>
              No Reviews Yet
            </Text>
            <Text style={[styles.emptyDescription, { color: cp.textMuted, fontSize: 14 * fontScale }]}>
              Complete a full week of your program to receive your first AI progress review.
            </Text>
          </View>
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
  headerSubtitle: {
    marginBottom: Spacing.lg,
  },
  reviewCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weekBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBadgeText: {
    fontWeight: '700',
  },
  cardTitle: {
    fontWeight: '600',
  },
  phaseLabel: {
    fontWeight: '500',
    marginTop: 1,
  },
  miniStats: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniStatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statPillText: {
  },
  messageContainer: {
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  messageHeaderText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontWeight: '600',
  },
  emptyDescription: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
