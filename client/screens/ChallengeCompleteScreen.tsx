import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { storage, UserProgress } from '@/lib/storage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChallengeCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { fontScale } = useAccessibility();
  const { cp, isDarkMode } = useThemePreference();
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    storage.getProgress().then(setProgress);
  }, []);

  const handleContinue = () => {
    navigation.navigate('Paywall');
  };

  const handleDismiss = () => {
    navigation.goBack();
  };

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
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View
            style={[
              styles.trophyContainer,
              { backgroundColor: `${cp.neonGreen}26`, borderColor: `${cp.neonGreen}4D` },
            ]}
          >
            <Feather name="award" size={52} color={cp.neonGreen} />
          </View>
          <Text style={[styles.label, { color: cp.neonGreen }]}>7-DAY CONTROL CHALLENGE</Text>
          <Text style={[styles.title, { color: cp.text, fontSize: 32 * fontScale }]}>
            Challenge Complete
          </Text>
          <Text style={[styles.subtitle, { color: cp.textSecondary }]}>
            You showed up. That's what this is about.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: cp.cardBg, borderColor: `${cp.neonGreen}33` },
            ]}
          >
            <Feather name="check-circle" size={22} color={cp.neonGreen} />
            <Text style={[styles.statValue, { color: cp.text, fontSize: 28 * fontScale }]}>
              {progress != null ? progress.totalSessions : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: cp.textSecondary }]}>Sessions</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: cp.cardBg, borderColor: `${cp.neonCyan}33` },
            ]}
          >
            <Feather name="clock" size={22} color={cp.neonCyan} />
            <Text style={[styles.statValue, { color: cp.text, fontSize: 28 * fontScale }]}>
              {progress != null ? progress.totalMinutes : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: cp.textSecondary }]}>Minutes</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: cp.cardBg, borderColor: `${cp.neonPurple}33` },
            ]}
          >
            <Feather name="zap" size={22} color={cp.neonPurple} />
            <Text style={[styles.statValue, { color: cp.text, fontSize: 28 * fontScale }]}>
              {progress != null ? progress.currentStreak : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: cp.textSecondary }]}>Day Streak</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)}>
          <View
            style={[
              styles.bridgeCard,
              {
                backgroundColor: isDarkMode ? 'rgba(26, 26, 46, 0.6)' : 'rgba(255,255,255,0.7)',
                borderColor: `${cp.neonGreen}26`,
              },
            ]}
          >
            <Text style={[styles.bridgeText, { color: cp.textSecondary }]}>
              The 7-day challenge is the foundation of a 12-week program built for real, lasting pelvic floor strength. You've done the hardest part — starting.
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400)} style={styles.ctaSection}>
          <Pressable
            style={[
              styles.continueButton,
              { backgroundColor: cp.neonGreen, shadowColor: cp.neonGreen },
            ]}
            onPress={handleContinue}
            testID="button-continue-program"
          >
            <Feather name="arrow-right" size={20} color={cp.bg} />
            <Text style={[styles.continueButtonText, { color: cp.bg }]}>
              Continue into the Full Program
            </Text>
          </Pressable>

          <Pressable
            style={styles.dismissButton}
            onPress={handleDismiss}
            testID="button-not-now"
          >
            <Text style={[styles.dismissButtonText, { color: cp.textMuted }]}>Not now</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  trophyContainer: {
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
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: {
    fontWeight: '700',
    lineHeight: 34,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  bridgeCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  bridgeText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  ctaSection: {
    gap: Spacing.md,
  },
  continueButton: {
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
  continueButtonText: {
    fontWeight: '700',
    fontSize: 17,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
