import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { storage } from '@/lib/storage';
import { trackChallengeResult, trackChallengeCta } from '@/lib/analytics';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ANIM_DURATION_EXIT_COMPLETE, ANIM_DELAY_SHORT, ANIM_DELAY_MED, ANIM_DELAY_LONG, ANIM_DELAY_XL } from '@/constants/animation';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
type ChallengeResult = 'not_started' | 'first_step' | 'partial' | 'complete' | 'strong_finish';

interface ChallengeStats {
  completedCoreSessions: number;
  totalCoreSessions: number;
  completedOptionalSessions: number;
}

function getChallengeResult(stats: ChallengeStats): ChallengeResult {
  if (stats.completedCoreSessions === 0) return 'not_started';
  if (stats.completedCoreSessions === 1) return 'first_step';
  if (stats.completedCoreSessions < stats.totalCoreSessions) return 'partial';
  if (stats.completedOptionalSessions > 0) return 'strong_finish';
  return 'complete';
}

interface ResultConfig {
  icon: FeatherIconName;
  iconAccent: 'neonGreen' | 'neonCyan' | 'textMuted';
  title: string;
  message: string;
  primaryLabel: string;
  primaryIsRestart: boolean;
  secondaryLabel: string;
  secondaryIsRestart: boolean;
}

const RESULT_CONFIGS: Record<ChallengeResult, ResultConfig> = {
  not_started: {
    icon: 'alert-circle',
    iconAccent: 'textMuted',
    title: 'Challenge Not Started',
    message:
      'No sessions were completed during the challenge window — and that\'s okay. The program is still here, ready whenever you are. Restarting takes one tap.',
    primaryLabel: 'Restart Challenge',
    primaryIsRestart: true,
    secondaryLabel: 'Continue Training',
    secondaryIsRestart: false,
  },
  first_step: {
    icon: 'trending-up',
    iconAccent: 'neonCyan',
    title: 'You Took the First Step.',
    message:
      'One session completed. You\'ve already proven you can show up. The full 12-week program is built on exactly that first step — keep going.',
    primaryLabel: 'Continue Training',
    primaryIsRestart: false,
    secondaryLabel: 'Restart the Challenge',
    secondaryIsRestart: true,
  },
  partial: {
    icon: 'zap',
    iconAccent: 'neonCyan',
    title: 'Good Start.',
    message:
      'Two of three core sessions done. You built a real habit this week. Carry that momentum into the full 12-week program and finish what you started.',
    primaryLabel: 'Continue Training',
    primaryIsRestart: false,
    secondaryLabel: 'Restart the Challenge',
    secondaryIsRestart: true,
  },
  complete: {
    icon: 'award',
    iconAccent: 'neonGreen',
    title: 'Challenge Complete.',
    message:
      'Every session done, every rep counted. The 7-day challenge is the foundation of a 12-week program built for real, lasting pelvic floor strength. You\'ve done the hardest part — starting.',
    primaryLabel: 'Continue Training',
    primaryIsRestart: false,
    secondaryLabel: 'Restart the Challenge',
    secondaryIsRestart: true,
  },
  strong_finish: {
    icon: 'star',
    iconAccent: 'neonGreen',
    title: 'Strong Finish.',
    message:
      'All core sessions completed — plus extra work on rest days. That initiative is exactly what the 12-week program is built to reward. Keep that energy.',
    primaryLabel: 'Continue Training',
    primaryIsRestart: false,
    secondaryLabel: 'Restart the Challenge',
    secondaryIsRestart: true,
  },
};

export default function ChallengeCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { fontScale } = useAccessibility();
  const { cp, isDarkMode } = useThemePreference();
  const { checkSubscription } = useSubscription();

  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartError, setRestartError] = useState(false);

  useEffect(() => {
    storage.getChallengeStats().then(setStats);
  }, []);

  useEffect(() => {
    if (stats === null) return;
    const result = getChallengeResult(stats);
    trackChallengeResult({
      result,
      completedCoreSessions: stats.completedCoreSessions,
      totalCoreSessions: stats.totalCoreSessions,
      completedOptionalSessions: stats.completedOptionalSessions,
    });
  }, [stats]);

  const handleContinue = () => {
    navigation.goBack();
  };

  const handleRestartConfirmed = async () => {
    setIsRestarting(true);
    setRestartError(false);
    try {
      await storage.resetChallengeProgress();
      await checkSubscription();
      navigation.replace('Main');
    } catch {
      setIsRestarting(false);
      setRestartError(true);
    }
  };

  const handlePrimary = () => {
    if (!stats) return;
    const result = getChallengeResult(stats);
    const cfg = RESULT_CONFIGS[result];
    trackChallengeCta({ result, button: 'primary', action: cfg.primaryIsRestart ? 'restart' : 'continue' });
    if (cfg.primaryIsRestart) {
      setShowConfirm(true);
    } else {
      handleContinue();
    }
  };

  const handleSecondary = () => {
    if (!stats) return;
    const result = getChallengeResult(stats);
    const cfg = RESULT_CONFIGS[result];
    trackChallengeCta({ result, button: 'secondary', action: cfg.secondaryIsRestart ? 'restart' : 'continue' });
    if (cfg.secondaryIsRestart) {
      setShowConfirm(true);
    } else {
      handleContinue();
    }
  };

  if (stats === null) {
    return (
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={cp.neonGreen} />
        </View>
      </LinearGradient>
    );
  }

  const result = getChallengeResult(stats);
  const config = RESULT_CONFIGS[result];
  const iconColor =
    config.iconAccent === 'neonGreen'
      ? cp.neonGreen
      : config.iconAccent === 'neonCyan'
      ? cp.neonCyan
      : cp.textMuted;

  return (
    <LinearGradient
      colors={cp.gradient as unknown as [string, string, ...string[]]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xl * 2, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(ANIM_DELAY_SHORT)} style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${iconColor}26`, borderColor: `${iconColor}4D` },
            ]}
          >
            <Feather name={config.icon} size={52} color={iconColor} />
          </View>
          <Text style={[styles.label, { color: iconColor }]}>7-DAY CONTROL CHALLENGE</Text>
          <Text style={[styles.title, { color: cp.text, fontSize: 32 * fontScale }]}>
            {config.title}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(ANIM_DELAY_MED)} style={styles.progressSection}>
          <View style={styles.progressDots}>
            {Array.from({ length: stats.totalCoreSessions }).map((_, i) => {
              const filled = i < stats.completedCoreSessions;
              return (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: filled ? iconColor : `${iconColor}30`,
                      borderColor: filled ? iconColor : `${iconColor}50`,
                    },
                  ]}
                >
                  {filled ? <Feather name="check" size={14} color={cp.bg} /> : null}
                </View>
              );
            })}
          </View>
          <Text style={[styles.progressLabel, { color: cp.textSecondary }]}>
            {'You completed '}
            <Text style={{ color: cp.text, fontWeight: '700' }}>
              {stats.completedCoreSessions}
            </Text>
            {` of ${stats.totalCoreSessions} core sessions`}
          </Text>
          {stats.completedOptionalSessions > 0 ? (
            <Text style={[styles.optionalLabel, { color: cp.neonCyan }]}>
              {`and ${stats.completedOptionalSessions} optional recovery ${
                stats.completedOptionalSessions === 1 ? 'session' : 'sessions'
              }.`}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(ANIM_DELAY_LONG)}>
          <View
            style={[
              styles.messageCard,
              {
                backgroundColor: isDarkMode ? 'rgba(26, 26, 46, 0.6)' : 'rgba(255,255,255,0.7)',
                borderColor: `${iconColor}26`,
              },
            ]}
          >
            <Text style={[styles.messageText, { color: cp.textSecondary }]}>
              {config.message}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(ANIM_DELAY_XL)} style={styles.ctaSection}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: iconColor, shadowColor: iconColor },
            ]}
            onPress={handlePrimary}
            testID="button-challenge-primary"
          >
            <Feather
              name={config.primaryIsRestart ? 'refresh-cw' : 'arrow-right'}
              size={20}
              color={cp.bg}
            />
            <Text style={[styles.primaryButtonText, { color: cp.bg }]}>
              {config.primaryLabel}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleSecondary}
            testID="button-challenge-secondary"
          >
            <Text style={[styles.secondaryButtonText, { color: cp.textMuted }]}>
              {config.secondaryLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            entering={FadeInDown.duration(ANIM_DURATION_EXIT_COMPLETE)}
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? '#1A1A2E' : '#FFFFFF',
                borderColor: `${cp.neonGreen}33`,
              },
            ]}
          >
            <View style={[styles.modalIconRow, { backgroundColor: `${cp.neonCyan}20` }]}>
              <Feather name="refresh-cw" size={28} color={cp.neonCyan} />
            </View>
            <Text style={[styles.modalTitle, { color: cp.text }]}>Restart the Challenge?</Text>
            <Text style={[styles.modalMessage, { color: cp.textSecondary }]}>
              Your challenge progress, streaks, and session dates will be cleared. Your badges and lifetime session totals are kept.
            </Text>
            {restartError ? (
              <Text style={[styles.errorText, { color: '#FF6B6B' }]}>
                Something went wrong. Please try again.
              </Text>
            ) : null}
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalCancel, { borderColor: `${cp.textMuted}40` }]}
                onPress={() => setShowConfirm(false)}
                testID="button-restart-cancel"
              >
                <Text style={[styles.modalCancelText, { color: cp.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: cp.neonCyan }]}
                onPress={handleRestartConfirmed}
                disabled={isRestarting}
                testID="button-restart-confirm"
              >
                <Text style={[styles.modalConfirmText, { color: cp.bg }]}>
                  {isRestarting ? 'Restarting...' : 'Restart'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 40,
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  progressDots: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  optionalLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  messageCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  ctaSection: {
    gap: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 4,
    borderRadius: BorderRadius.full,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryButtonText: {
    fontWeight: '700',
    fontSize: 17,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  modalIconRow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    width: '100%',
  },
  modalCancel: {
    flex: 1,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontWeight: '600',
    fontSize: 15,
  },
  modalConfirm: {
    flex: 1,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
