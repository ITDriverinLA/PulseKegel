import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Text, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, WeeklyReviewEntry } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';

const NEON_GREEN = '#00ff88';
const NEON_CYAN = '#00d4ff';
const NEON_PURPLE = '#a855f7';
const NEON_PINK = '#ff6b9d';

function getPhaseForWeek(week: number): { name: string; color: string } {
  if (week <= 2) return { name: 'Control Phase', color: NEON_CYAN };
  if (week <= 6) return { name: 'Strength Phase', color: NEON_GREEN };
  if (week <= 10) return { name: 'Power Phase', color: NEON_PINK };
  return { name: 'Maintenance Phase', color: NEON_PURPLE };
}

function getAccentForDays(days: number): string {
  if (days >= 5) return NEON_GREEN;
  if (days >= 3) return NEON_CYAN;
  return NEON_PURPLE;
}

export default function ReviewHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { fontScale, colors, highContrast } = useAccessibility();

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
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
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
            tintColor={NEON_CYAN}
          />
        }
      >
        {reviews.length > 0 ? (
          <>
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={[styles.headerSubtitle, { fontSize: 13 * fontScale }]}>
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
                  entering={FadeInDown.duration(300).delay(100 + index * 80)}
                >
                  <Pressable
                    style={[
                      styles.reviewCard,
                      isExpanded && styles.reviewCardExpanded,
                      highContrast && { borderColor: colors.border },
                    ]}
                    onPress={() => toggleExpanded(review.weekNumber)}
                    testID={`review-card-week-${review.weekNumber}`}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.weekBadge, { backgroundColor: `${accent}20` }]}>
                          <Text style={[styles.weekBadgeText, { color: accent, fontSize: 12 * fontScale }]}>
                            W{review.weekNumber}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.cardTitle, { fontSize: 15 * fontScale }]}>
                            Week {review.weekNumber}
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
                          color="rgba(255,255,255,0.4)"
                        />
                      </View>
                    </View>

                    {isExpanded ? (
                      <View style={styles.expandedContent}>
                        <View style={styles.statsRow}>
                          <View style={[styles.statPill, { borderColor: `${accent}30` }]}>
                            <Feather name="calendar" size={14} color={accent} />
                            <Text style={[styles.statPillText, { fontSize: 12 * fontScale }]}>
                              {review.daysWorkedOut} days active
                            </Text>
                          </View>
                          <View style={[styles.statPill, { borderColor: 'rgba(255,255,255,0.15)' }]}>
                            <Feather name="clock" size={14} color="rgba(255,255,255,0.6)" />
                            <Text style={[styles.statPillText, { fontSize: 12 * fontScale }]}>
                              {review.date}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.messageContainer}>
                          <View style={styles.messageHeader}>
                            <Feather name="cpu" size={14} color={NEON_PURPLE} />
                            <Text style={[styles.messageHeaderText, { fontSize: 11 * fontScale }]}>
                              AI Insight
                            </Text>
                          </View>
                          <Text style={[styles.messageText, { fontSize: 14 * fontScale, lineHeight: 22 * fontScale }]}>
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
            <Feather name="book-open" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={[styles.emptyTitle, { fontSize: 18 * fontScale }]}>
              No Reviews Yet
            </Text>
            <Text style={[styles.emptyDescription, { fontSize: 14 * fontScale }]}>
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
    color: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.lg,
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reviewCardExpanded: {
    borderColor: 'rgba(168, 85, 247, 0.25)',
    backgroundColor: 'rgba(168, 85, 247, 0.04)',
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
    color: '#fff',
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
    borderTopColor: 'rgba(255,255,255,0.06)',
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
    color: 'rgba(255,255,255,0.7)',
  },
  messageContainer: {
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.12)',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  messageHeaderText: {
    color: NEON_PURPLE,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    color: 'rgba(255,255,255,0.85)',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyDescription: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
});
