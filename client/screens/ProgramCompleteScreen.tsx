import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { Spacing, BorderRadius } from "@/constants/theme";
import { ANIM_DURATION_CONTENT, ANIM_DELAY_SHORT } from "@/constants/animation";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { storage } from "@/lib/storage";
import {
  type ControlModePath,
  type CompletionTier,
  type TwelveWeekEvaluation,
  CONTROL_MODE_LABEL,
  CONTROL_MODE_TAGLINE,
  CONTROL_MODE_WEEKLY_TARGET,
} from "@/lib/programCompletion";
import { type RankName } from "@/lib/controlScore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OptionCardProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}

const OptionCard: React.FC<OptionCardProps> = ({
  icon,
  title,
  subtitle,
  accent,
  onPress,
  testID,
  disabled,
}) => {
  const { fontScale } = useAccessibility();
  const { cp } = useThemePreference();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor: cp.cardBg,
          borderColor: `${accent}66`,
          opacity: pressed || disabled ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          { backgroundColor: `${accent}26`, borderColor: `${accent}55` },
        ]}
      >
        <Feather name={icon} size={20} color={accent} />
      </View>
      <View style={styles.optionTextWrap}>
        <Text
          style={[
            styles.optionTitle,
            { color: cp.text, fontSize: 16 * fontScale },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.optionSubtitle,
            { color: cp.textSecondary, fontSize: 13 * fontScale },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={cp.textMuted} />
    </Pressable>
  );
};

interface StatPillProps {
  label: string;
  value: string;
  accent: string;
}

const StatPill: React.FC<StatPillProps> = ({ label, value, accent }) => {
  const { cp } = useThemePreference();
  const { fontScale } = useAccessibility();
  return (
    <View
      style={[
        styles.statPill,
        { backgroundColor: `${accent}1A`, borderColor: `${accent}4D` },
      ]}
    >
      <Text
        style={[styles.statValue, { color: accent, fontSize: 22 * fontScale }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: cp.textSecondary, fontSize: 11 * fontScale },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

export default function ProgramCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { fontScale } = useAccessibility();
  const { cp } = useThemePreference();

  const [evaluation, setEvaluation] = useState<TwelveWeekEvaluation | null>(
    null,
  );
  const [currentRank, setCurrentRank] = useState<RankName>("Rookie");
  const [highestRank, setHighestRank] = useState<RankName>("Rookie");
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [evalResult, scoreState] = await Promise.all([
        storage.evaluateAndStoreCompletionTier(),
        storage.getControlScoreState(),
      ]);
      if (!active) return;
      setEvaluation(evalResult);
      setCurrentRank(scoreState.currentRank);
      setHighestRank(scoreState.highestRankAchieved);
      setScore(scoreState.controlScore);
    })();
    return () => {
      active = false;
    };
  }, []);

  const tier: CompletionTier = evaluation?.tier ?? "low";

  const finishAndGoHome = () => {
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  const handleChooseControlPath = async (path: ControlModePath) => {
    if (busy) return;
    setBusy(true);
    try {
      await storage.switchToControlMode(path);
      finishAndGoHome();
    } finally {
      setBusy(false);
    }
  };

  const handleRestart12 = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await storage.restartTwelveWeekProgram();
      finishAndGoHome();
    } finally {
      setBusy(false);
    }
  };

  const handleRestartWk5 = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await storage.restartFromWeekFive();
      finishAndGoHome();
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchMaintenance = async () => {
    await handleChooseControlPath("maintain");
  };

  const handleSevenDayCalibration = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await storage.restartSevenDayCalibration();
      finishAndGoHome();
    } finally {
      setBusy(false);
    }
  };

  const handleThreeDayPlan = async () => {
    await handleChooseControlPath("rebuild");
  };

  if (!evaluation) {
    return (
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
        style={styles.gradientContainer}
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={cp.neonGreen} />
        </View>
      </LinearGradient>
    );
  }

  const headerAccent =
    tier === "strong"
      ? cp.neonGreen
      : tier === "partial"
        ? cp.neonCyan
        : cp.neonOrange;

  const heading =
    tier === "strong"
      ? "12 Weeks Complete"
      : tier === "partial"
        ? "Progress Made"
        : "Let's Reset the Plan";

  const subheading =
    tier === "strong"
      ? "Outstanding training. You've earned Control Mode."
      : tier === "partial"
        ? "You built a real foundation. Pick what's next."
        : "Every athlete restarts. Here are three ways forward.";

  return (
    <LinearGradient
      colors={cp.gradient as unknown as [string, string, ...string[]]}
      style={styles.gradientContainer}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_SHORT,
          )}
        >
          <View
            style={[
              styles.heroBadge,
              {
                backgroundColor: `${headerAccent}1A`,
                borderColor: `${headerAccent}4D`,
              },
            ]}
          >
            <Feather
              name={
                tier === "strong"
                  ? "award"
                  : tier === "partial"
                    ? "trending-up"
                    : "refresh-cw"
              }
              size={36}
              color={headerAccent}
            />
          </View>

          <Text
            style={[
              styles.heading,
              { color: cp.text, fontSize: 28 * fontScale },
            ]}
            testID="text-completion-heading"
          >
            {heading}
          </Text>
          <Text
            style={[
              styles.subheading,
              { color: cp.textSecondary, fontSize: 15 * fontScale },
            ]}
            testID="text-completion-subheading"
          >
            {subheading}
          </Text>

          <View style={styles.statsRow}>
            <StatPill
              label="Training Days"
              value={String(evaluation.uniqueTrainingDays)}
              accent={cp.neonGreen}
            />
            <StatPill
              label="Control Score"
              value={String(score)}
              accent={cp.neonCyan}
            />
            <StatPill
              label="Highest Rank"
              value={highestRank}
              accent={cp.neonPurple}
            />
          </View>

          <View
            style={[
              styles.rankRow,
              {
                backgroundColor: cp.cardBg,
                borderColor: cp.cardBorder,
              },
            ]}
          >
            <Feather name="shield" size={16} color={cp.neonCyan} />
            <Text
              style={[
                styles.rankRowText,
                { color: cp.textSecondary, fontSize: 13 * fontScale },
              ]}
            >
              Current rank: {currentRank}
            </Text>
          </View>
        </Animated.View>

        {tier === "strong" ? (
          <View style={styles.optionsGroup}>
            <Text
              style={[
                styles.groupLabel,
                { color: cp.textMuted, fontSize: 12 * fontScale },
              ]}
            >
              CHOOSE YOUR CONTROL MODE PATH
            </Text>
            <OptionCard
              icon="activity"
              title={`${CONTROL_MODE_LABEL.maintain} (${CONTROL_MODE_WEEKLY_TARGET.maintain}/wk)`}
              subtitle={CONTROL_MODE_TAGLINE.maintain}
              accent={cp.neonGreen}
              onPress={() => handleChooseControlPath("maintain")}
              testID="option-control-maintain"
              disabled={busy}
            />
            <OptionCard
              icon="trending-up"
              title={`${CONTROL_MODE_LABEL.build} (${CONTROL_MODE_WEEKLY_TARGET.build}/wk)`}
              subtitle={CONTROL_MODE_TAGLINE.build}
              accent={cp.neonCyan}
              onPress={() => handleChooseControlPath("build")}
              testID="option-control-build"
              disabled={busy}
            />
            <OptionCard
              icon="target"
              title={`${CONTROL_MODE_LABEL.precision} (${CONTROL_MODE_WEEKLY_TARGET.precision}/wk)`}
              subtitle={CONTROL_MODE_TAGLINE.precision}
              accent={cp.neonPurple}
              onPress={() => handleChooseControlPath("precision")}
              testID="option-control-precision"
              disabled={busy}
            />
          </View>
        ) : null}

        {tier === "partial" ? (
          <View style={styles.optionsGroup}>
            <Text
              style={[
                styles.groupLabel,
                { color: cp.textMuted, fontSize: 12 * fontScale },
              ]}
            >
              PICK YOUR NEXT STEP
            </Text>
            <OptionCard
              icon="rotate-ccw"
              title="Repeat the 12-Week Program"
              subtitle="Start fresh. Your rank and score carry over."
              accent={cp.neonGreen}
              onPress={handleRestart12}
              testID="option-repeat-12week"
              disabled={busy}
            />
            <OptionCard
              icon="skip-forward"
              title="Restart from Week 5"
              subtitle="Skip the early weeks and pick up at Strength."
              accent={cp.neonCyan}
              onPress={handleRestartWk5}
              testID="option-restart-week5"
              disabled={busy}
            />
            <OptionCard
              icon="activity"
              title="Switch to Maintenance"
              subtitle="4 sessions a week to hold what you've built."
              accent={cp.neonPurple}
              onPress={handleSwitchMaintenance}
              testID="option-switch-maintenance"
              disabled={busy}
            />
          </View>
        ) : null}

        {tier === "low" ? (
          <View style={styles.optionsGroup}>
            <Text
              style={[
                styles.groupLabel,
                { color: cp.textMuted, fontSize: 12 * fontScale },
              ]}
            >
              CHOOSE A FRESH START
            </Text>
            <OptionCard
              icon="rotate-ccw"
              title="Restart the 12-Week Program"
              subtitle="Full reset. Your highest rank stays preserved."
              accent={cp.neonGreen}
              onPress={handleRestart12}
              testID="option-restart-12week"
              disabled={busy}
            />
            <OptionCard
              icon="zap"
              title="7-Day Calibration"
              subtitle="Quick week to find the right intensity."
              accent={cp.neonCyan}
              onPress={handleSevenDayCalibration}
              testID="option-seven-day-calibration"
              disabled={busy}
            />
            <OptionCard
              icon="clock"
              title="3-Day Plan"
              subtitle="Three sessions a week to rebuild the habit."
              accent={cp.neonPurple}
              onPress={handleThreeDayPlan}
              testID="option-three-day-plan"
              disabled={busy}
            />
          </View>
        ) : null}

        <Text
          style={[
            styles.footnote,
            { color: cp.textMuted, fontSize: 12 * fontScale },
          ]}
        >
          Your control score, current rank, and lifetime progress are preserved
          across every option.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  heading: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subheading: {
    textAlign: "center",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statPill: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
  },
  statValue: {
    fontWeight: "700",
    marginBottom: 2,
  },
  statLabel: {
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  rankRowText: {
    fontWeight: "500",
  },
  optionsGroup: {
    marginTop: Spacing.md,
  },
  groupLabel: {
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  optionSubtitle: {
    lineHeight: 18,
  },
  footnote: {
    textAlign: "center",
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    lineHeight: 18,
  },
});
