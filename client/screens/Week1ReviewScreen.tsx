import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/theme';
import { ANIM_DURATION_EXIT_COMPLETE, ANIM_DURATION_ZOOM, ANIM_DURATION_PULSE_LOADING, ANIM_DELAY_150, ANIM_DELAY_250, ANIM_DELAY_350, ANIM_DELAY_450 } from '@/constants/animation';
import { storage } from '@/lib/storage';
import { getApiUrl } from '@/lib/query-client';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function Week1ReviewScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { cp, isDarkMode } = useThemePreference();

  const [sessions, setSessions] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [buttonDisabled, setButtonDisabled] = useState(false);

  const pulseAnim = useRef(new RNAnimated.Value(0.4)).current;
  const screenOpacity = useSharedValue(1);
  const screenAnimatedStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  useEffect(() => {
    loadStatsAndMessage();
  }, []);

  useEffect(() => {
    if (loading) {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: ANIM_DURATION_PULSE_LOADING, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 0.4, duration: ANIM_DURATION_PULSE_LOADING, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [loading]);

  const loadStatsAndMessage = async () => {
    try {
      const [progress, settings] = await Promise.all([
        storage.getProgress(),
        storage.getSettings(),
      ]);

      const totalSessions = progress.totalSessions;
      const totalMinutes = progress.totalMinutes;
      const currentStreak = progress.currentStreak;

      setSessions(totalSessions);
      setMinutes(totalMinutes);
      setStreak(currentStreak);

      await fetchMessage(totalSessions, totalMinutes, currentStreak, settings.anatomyType, settings.userName);
    } catch {
      setLoading(false);
      setMessage('Week 1 is behind you. The foundation is set — now it is time to go further.');
      setButtonDisabled(true);
      setTimeout(() => setButtonDisabled(false), 1500);
    }
  };

  const fetchMessage = async (
    totalSessions: number,
    totalMinutes: number,
    currentStreak: number,
    anatomyType: string | null,
    userName: string,
  ) => {
    try {
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/weekly-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekNumber: 1,
          daysWorkedOut: totalSessions,
          totalMinutes,
          anatomyType,
          userName,
          currentStreak,
        }),
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      setMessage(data.message);
    } catch {
      const fallback = buildFallbackMessage(totalSessions);
      setMessage(fallback);
    } finally {
      setLoading(false);
      setButtonDisabled(true);
      setTimeout(() => setButtonDisabled(false), 1500);
    }
  };

  const buildFallbackMessage = (completedSessions: number): string => {
    if (completedSessions === 0) {
      return 'Week 1 passed without a session. That is okay — the 12-week program is still ahead. One session is all it takes to get started.';
    }
    if (completedSessions === 1) {
      return 'You took the first step. That single session is evidence you can do this. The full program is waiting for you.';
    }
    if (completedSessions >= 3) {
      return `${completedSessions} sessions in week 1 — solid work. Carry that consistency into the full program and the results will follow.`;
    }
    return `${completedSessions} sessions completed in week 1. You started, and that matters. Now it is time to build on it.`;
  };

  const getAccentColor = () => {
    if (sessions >= 3) return cp.neonGreen;
    if (sessions >= 1) return cp.neonCyan;
    return cp.neonPurple;
  };

  const getIcon = (): React.ComponentProps<typeof Feather>['name'] => {
    if (sessions >= 3) return 'award';
    if (sessions >= 1) return 'trending-up';
    return 'heart';
  };

  const accentColor = getAccentColor();

  const doNavigate = () => {
    navigation.replace('ChallengeComplete');
  };

  const handleContinue = async () => {
    if (message) {
      await storage.saveWeeklyReviewToHistory({
        weekNumber: 0,
        daysWorkedOut: sessions,
        totalMinutes: minutes,
        message,
        date: new Date().toISOString().split('T')[0],
      });
    }
    screenOpacity.value = withTiming(0, { duration: ANIM_DURATION_EXIT_COMPLETE }, (finished) => {
      if (finished) {
        runOnJS(doNavigate)();
      }
    });
  };

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimatedStyle]}>
    <LinearGradient
      colors={isDarkMode ? ['#0f0f23', '#16213e', '#1a1a2e'] : ['#f0f2f7', '#e8eaf0', '#dde0e8']}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing['2xl'], paddingBottom: insets.bottom + Spacing['2xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={ZoomIn.duration(ANIM_DURATION_ZOOM)} style={styles.iconWrapper}>
          <LinearGradient
            colors={[accentColor, cp.neonPink]}
            style={styles.iconGradient}
          >
            <Feather name={getIcon()} size={56} color="#000" />
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(ANIM_DELAY_150)} style={styles.titleBlock}>
          <ThemedText type="h1" style={[styles.title, { color: accentColor }]}>
            Week 1 Complete
          </ThemedText>
          <ThemedText type="small" style={[styles.subtitle, { color: cp.textSecondary }]}>
            Here is how your first week went
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(ANIM_DELAY_250)} style={[styles.statsRow, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={[styles.statValue, { color: accentColor }]}>
              {sessions}
            </ThemedText>
            <ThemedText type="small" style={[styles.statLabel, { color: cp.textSecondary }]}>
              Sessions
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: cp.cardBorder }]} />

          <View style={styles.statItem}>
            <ThemedText type="h2" style={[styles.statValue, { color: accentColor }]}>
              {minutes}
            </ThemedText>
            <ThemedText type="small" style={[styles.statLabel, { color: cp.textSecondary }]}>
              Minutes
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: cp.cardBorder }]} />

          <View style={styles.statItem}>
            <ThemedText type="h2" style={[styles.statValue, { color: accentColor }]}>
              {streak}
            </ThemedText>
            <ThemedText type="small" style={[styles.statLabel, { color: cp.textSecondary }]}>
              Day Streak
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(ANIM_DELAY_350)} style={[styles.messageCard, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
          {loading ? (
            <RNAnimated.Text style={[styles.loadingText, { color: accentColor, opacity: pulseAnim }]}>
              Reviewing your progress...
            </RNAnimated.Text>
          ) : (
            <ThemedText type="body" style={[styles.message, { color: cp.textSecondary }]}>
              {message}
            </ThemedText>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(ANIM_DELAY_450)} style={styles.buttonWrapper}>
          <Pressable
            testID="button-continue-week1-review"
            onPress={loading || buttonDisabled ? undefined : handleContinue}
            style={loading || buttonDisabled ? { opacity: 0.5 } : null}
          >
            <LinearGradient
              colors={loading ? [cp.cardBorder, cp.cardBorder] : [accentColor, cp.neonCyan]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <ThemedText type="body" style={styles.buttonText}>
                {loading ? 'One moment...' : 'Continue'}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconWrapper: {
    marginBottom: Spacing.xl,
  },
  iconGradient: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 48,
    marginHorizontal: Spacing.sm,
  },
  messageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing['2xl'],
    width: '100%',
    minHeight: 80,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonWrapper: {
    width: '100%',
  },
  button: {
    paddingVertical: Spacing.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
