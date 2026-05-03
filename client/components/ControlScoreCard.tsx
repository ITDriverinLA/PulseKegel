import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { ControlScoreState } from "@/lib/storage";
import {
  getNextRank,
  getPointsToNextRank,
  getRankBandProgress,
  getTrend,
  todayDateString,
  Trend,
} from "@/lib/controlScore";

interface Props {
  state: ControlScoreState;
}

const TREND_LABELS: Record<Trend, { label: string; icon: string }> = {
  gaining: { label: "Gaining", icon: "trending-up" },
  holding: { label: "Holding", icon: "minus" },
  slipping: { label: "Slipping", icon: "trending-down" },
};

export function ControlScoreCard({ state }: Props) {
  const { cp, isDarkMode } = useThemePreference();
  const { fontScale } = useAccessibility();

  const next = getNextRank(state.currentRank);
  const progress = getRankBandProgress(state.controlScore);
  const pointsToNext = getPointsToNextRank(state.controlScore);
  const trend = getTrend(
    state.scoreHistory,
    state.controlScore,
    todayDateString(),
  );
  const trendInfo = TREND_LABELS[trend];

  const trendColor =
    trend === "gaining"
      ? cp.neonGreen
      : trend === "slipping"
        ? cp.neonOrange
        : cp.textSecondary;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
      ]}
      testID="control-score-card"
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.rankLabel,
              { color: cp.textMuted, fontSize: 11 * fontScale },
            ]}
          >
            RANK
          </Text>
          <Text
            style={[
              styles.rankName,
              {
                color: cp.neonCyan,
                fontSize: 22 * fontScale,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
            testID="text-current-rank"
          >
            {state.currentRank}
          </Text>
        </View>
        <View
          style={[
            styles.trendChip,
            {
              backgroundColor: `${trendColor}1A`,
              borderColor: `${trendColor}55`,
            },
          ]}
        >
          <Feather name={trendInfo.icon as any} size={12} color={trendColor} />
          <Text
            style={[
              styles.trendText,
              { color: trendColor, fontSize: 11 * fontScale },
            ]}
          >
            {trendInfo.label}
          </Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <Text
          style={[styles.score, { color: cp.text, fontSize: 28 * fontScale }]}
          testID="text-control-score"
        >
          {state.controlScore}
        </Text>
        <Text
          style={[
            styles.scoreMax,
            { color: cp.textMuted, fontSize: 14 * fontScale },
          ]}
        >
          / 1000
        </Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: cp.divider }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(2, progress * 100)}%`,
              backgroundColor: cp.neonGreen,
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.nextRankText,
          { color: cp.textSecondary, fontSize: 12 * fontScale },
        ]}
      >
        {next
          ? `${pointsToNext} ${pointsToNext === 1 ? "point" : "points"} to ${next.name}`
          : "Elite reached — keep your edge."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "column",
  },
  rankLabel: {
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  rankName: {
    fontWeight: "700",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  trendText: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.sm,
  },
  score: {
    fontWeight: "700",
  },
  scoreMax: {
    marginLeft: 4,
    fontWeight: "500",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  nextRankText: {
    marginTop: 4,
  },
});
