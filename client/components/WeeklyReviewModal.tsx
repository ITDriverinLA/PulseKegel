import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Modal, Pressable, Animated as RNAnimated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';
import { AnatomyType } from '@/lib/storage';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';

interface WeeklyReviewModalProps {
  visible: boolean;
  onClose: () => void;
  weekNumber: number;
  daysWorkedOut: number;
  totalMinutes: number;
  anatomyType: AnatomyType;
  userName: string;
  onMessageReady?: (message: string) => void;
}

export function WeeklyReviewModal({
  visible,
  onClose,
  weekNumber,
  daysWorkedOut,
  totalMinutes,
  anatomyType,
  userName,
  onMessageReady,
}: WeeklyReviewModalProps) {
  const { cp, isDarkMode } = useThemePreference();
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      fetchReviewMessage();
    }
  }, [visible, weekNumber, daysWorkedOut, totalMinutes, anatomyType, userName]);

  const fetchReviewMessage = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/weekly-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekNumber, daysWorkedOut, totalMinutes, anatomyType, userName }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setMessage(data.message);
      onMessageReady?.(data.message);
    } catch (error) {
      const fallback = weekNumber === 1 
        ? "You completed your first week! Your pelvic floor is already getting stronger."
        : `${weekNumber} weeks down! Your consistency is building real strength.`;
      setMessage(fallback);
      onMessageReady?.(fallback);
    } finally {
      setLoading(false);
    }
  };

  const getAccentColor = () => {
    if (daysWorkedOut >= 5) return cp.neonGreen;
    if (daysWorkedOut >= 3) return cp.neonCyan;
    return cp.neonPurple;
  };

  const getIcon = () => {
    if (daysWorkedOut >= 5) return 'award';
    if (daysWorkedOut >= 3) return 'trending-up';
    return 'heart';
  };

  const accentColor = getAccentColor();

  const pulseAnim = useRef(new RNAnimated.Value(0.4)).current;

  useEffect(() => {
    if (loading) {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [loading]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: cp.overlay }]}>
        <Animated.View entering={ZoomIn.duration(300)} style={styles.container}>
          <LinearGradient
            colors={isDarkMode ? ['#1a1a2e', '#16213e', '#0f0f23'] : ['#ffffff', '#f5f7fc', '#eef1f8']}
            style={styles.gradient}
          >
            <Animated.View entering={FadeIn.delay(200)} style={styles.iconContainer}>
              <LinearGradient
                colors={[accentColor, cp.neonPink]}
                style={styles.iconGradient}
              >
                <Feather name={getIcon()} size={48} color={cp.text} />
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(300)}>
              <ThemedText type="h2" style={[styles.title, { color: accentColor, textShadowColor: isDarkMode ? accentColor : 'transparent' }]}>
                Week {weekNumber} Complete
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(400)} style={styles.statsContainer}>
              <View style={styles.statItem}>
                <ThemedText type="h3" style={[styles.statValue, { color: accentColor }]}>
                  {daysWorkedOut}
                </ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: cp.textSecondary }]}>
                  Days Active
                </ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: cp.cardBorder }]} />
              <View style={styles.statItem}>
                <ThemedText type="h3" style={[styles.statValue, { color: accentColor }]}>
                  {totalMinutes}
                </ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: cp.textSecondary }]}>
                  Minutes
                </ThemedText>
              </View>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(500)} style={styles.messageContainer}>
              {loading ? (
                <RNAnimated.Text style={[styles.loadingText, { color: accentColor, opacity: pulseAnim }]}>
                  Analysing Progress...
                </RNAnimated.Text>
              ) : (
                <ThemedText type="body" style={[styles.message, { color: cp.textSecondary }]}>
                  {message}
                </ThemedText>
              )}
            </Animated.View>

            <Animated.View entering={FadeIn.delay(600)}>
              <Pressable onPress={onClose} style={styles.button}>
                <LinearGradient
                  colors={[accentColor, cp.neonCyan]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <ThemedText type="body" style={styles.buttonText}>
                    Continue
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  messageContainer: {
    minHeight: 60,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
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
  button: {
    width: '100%',
  },
  buttonGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
  },
});
