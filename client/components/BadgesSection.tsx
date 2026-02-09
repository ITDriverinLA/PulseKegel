import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, Modal } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { BADGE_DEFINITIONS, BadgeDefinition, EarnedBadge, getBadgeById } from '@/data/badges';
import { storage } from '@/lib/storage';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useAccessibility } from '@/contexts/AccessibilityContext';

const CATEGORY_ORDER: BadgeDefinition['category'][] = ['streak', 'milestone', 'phase', 'mastery', 'special'];
const CATEGORY_LABELS: Record<BadgeDefinition['category'], string> = {
  streak: 'Streaks',
  milestone: 'Milestones',
  phase: 'Program Phases',
  mastery: 'Mastery',
  special: 'Special',
};

export function BadgesSection() {
  const { fontScale, highContrast, colors } = useAccessibility();
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
  const [selectedEarned, setSelectedEarned] = useState<EarnedBadge | null>(null);

  const loadBadges = useCallback(async () => {
    const badges = await storage.getEarnedBadges();
    setEarnedBadges(badges);
  }, []);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  const earnedIds = new Set(earnedBadges.map(b => b.badgeId));
  const earnedCount = earnedBadges.length;
  const totalCount = BADGE_DEFINITIONS.length;

  const handleBadgePress = (badge: BadgeDefinition) => {
    const earned = earnedBadges.find(e => e.badgeId === badge.id);
    setSelectedBadge(badge);
    setSelectedEarned(earned || null);
  };

  const renderBadgeItem = (badge: BadgeDefinition, index: number) => {
    const isEarned = earnedIds.has(badge.id);

    return (
      <Pressable
        key={badge.id}
        style={[
          styles.badgeItem,
          isEarned && { borderColor: `${badge.color}30` },
          highContrast && isEarned && { borderColor: colors.border },
        ]}
        onPress={() => handleBadgePress(badge)}
        testID={`badge-${badge.id}`}
      >
        <View
          style={[
            styles.badgeIcon,
            isEarned
              ? { backgroundColor: `${badge.color}15` }
              : { backgroundColor: 'rgba(255,255,255,0.03)' },
          ]}
        >
          <Feather
            name={badge.icon as any}
            size={20}
            color={isEarned ? badge.color : 'rgba(255,255,255,0.15)'}
          />
        </View>
        <Text
          style={[
            styles.badgeName,
            { fontSize: 10 * fontScale },
            isEarned ? { color: 'rgba(255,255,255,0.9)' } : { color: 'rgba(255,255,255,0.25)' },
          ]}
          numberOfLines={1}
        >
          {badge.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="award" size={16} color="#fbbf24" />
          <Text style={[styles.headerTitle, { fontSize: 15 * fontScale }]}>
            Badges
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.progressText, { fontSize: 12 * fontScale }]}>
            {earnedCount}/{totalCount}
          </Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` },
          ]}
        />
      </View>

      {CATEGORY_ORDER.map((category) => {
        const badges = BADGE_DEFINITIONS.filter(b => b.category === category);
        if (badges.length === 0) return null;

        return (
          <View key={category} style={styles.categorySection}>
            <Text style={[styles.categoryLabel, { fontSize: 11 * fontScale }]}>
              {CATEGORY_LABELS[category]}
            </Text>
            <View style={styles.badgeGrid}>
              {badges.map((badge, i) => renderBadgeItem(badge, i))}
            </View>
          </View>
        );
      })}

      <Modal
        visible={selectedBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedBadge(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <LinearGradient
              colors={['rgba(20, 10, 40, 0.98)', 'rgba(10, 20, 40, 0.98)']}
              style={styles.modalGradient}
            >
              {selectedBadge ? (
                <>
                  <View
                    style={[
                      styles.modalIconOuter,
                      {
                        borderColor: selectedEarned
                          ? `${selectedBadge.color}40`
                          : 'rgba(255,255,255,0.08)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.modalIcon,
                        {
                          backgroundColor: selectedEarned
                            ? `${selectedBadge.color}15`
                            : 'rgba(255,255,255,0.03)',
                        },
                      ]}
                    >
                      <Feather
                        name={selectedBadge.icon as any}
                        size={36}
                        color={
                          selectedEarned
                            ? selectedBadge.color
                            : 'rgba(255,255,255,0.15)'
                        }
                      />
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        fontSize: 20 * fontScale,
                        color: selectedEarned
                          ? selectedBadge.color
                          : 'rgba(255,255,255,0.3)',
                      },
                    ]}
                  >
                    {selectedBadge.name}
                  </Text>

                  <Text style={[styles.modalDescription, { fontSize: 14 * fontScale }]}>
                    {selectedBadge.description}
                  </Text>

                  {selectedEarned ? (
                    <View style={[styles.earnedTag, { borderColor: `${selectedBadge.color}30` }]}>
                      <Feather name="check-circle" size={14} color={selectedBadge.color} />
                      <Text style={[styles.earnedTagText, { color: selectedBadge.color, fontSize: 12 * fontScale }]}>
                        Earned {selectedEarned.earnedDate}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.lockedTag}>
                      <Feather name="lock" size={14} color="rgba(255,255,255,0.3)" />
                      <Text style={[styles.lockedTagText, { fontSize: 12 * fontScale }]}>
                        Not yet earned
                      </Text>
                    </View>
                  )}

                  <Pressable
                    style={styles.modalDismiss}
                    onPress={() => setSelectedBadge(null)}
                    testID="button-dismiss-badge-detail"
                  >
                    <Text style={styles.modalDismissText}>Close</Text>
                  </Pressable>
                </>
              ) : null}
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  headerRight: {},
  progressText: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 2,
  },
  categorySection: {
    marginBottom: Spacing.md,
  },
  categoryLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badgeItem: {
    width: 72,
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badgeName: {
    textAlign: 'center',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  earnedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  earnedTagText: {
    fontWeight: '600',
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.lg,
  },
  lockedTagText: {
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '600',
  },
  modalDismiss: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalDismissText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontSize: 14,
  },
});
