import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BREATHWORK_COLORS, getModeConfig, BreathworkMode } from '@/constants/breathworkModes';
import { storage } from '@/lib/storage';
import { cancelTodaysReminderIfCompleted } from '@/lib/notifications';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type SummaryRoute = RouteProp<RootStackParamList, 'BreathworkSummary'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BreathworkSummaryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SummaryRoute>();
  const { mode } = route.params;
  const config = getModeConfig(mode);
  const [logged, setLogged] = useState(false);

  const handleLogSession = async () => {
    const today = new Date().toISOString().split('T')[0];
    await storage.addCompletedDate(today, 5);
    setLogged(true);
    await cancelTodaysReminderIfCompleted();
  };

  const handleDismiss = () => {
    navigation.popToTop();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Feather name="check-circle" size={64} color={BREATHWORK_COLORS.circle_inhale} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <Text style={styles.title}>Session Complete</Text>
          <Text style={styles.modeName}>{config.name}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="clock" size={20} color={BREATHWORK_COLORS.circle_inhale} />
            <Text style={styles.statValue}>5:00</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="wind" size={20} color={BREATHWORK_COLORS.circle_inhale} />
            <Text style={styles.statValue}>{config.subtitle}</Text>
            <Text style={styles.statLabel}>Technique</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.buttonsContainer}>
          {logged ? (
            <View style={styles.loggedContainer}>
              <Feather name="check" size={20} color={BREATHWORK_COLORS.circle_inhale} />
              <Text style={styles.loggedText}>Session logged to your streak</Text>
            </View>
          ) : (
            <Pressable onPress={handleLogSession} testID="breathwork-log-button">
              <LinearGradient
                colors={['#00B4C5', '#0090A0']}
                style={styles.logButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Feather name="plus-circle" size={20} color="#FFFFFF" />
                <Text style={styles.logButtonText}>Log Session</Text>
              </LinearGradient>
            </Pressable>
          )}

          <Pressable onPress={handleDismiss} style={styles.dismissButton} testID="breathwork-dismiss-button">
            <Text style={styles.dismissText}>{logged ? 'Done' : 'Skip'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BREATHWORK_COLORS.bg_session,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 32,
  },
  iconContainer: {
    marginBottom: 8,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 180, 197, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: BREATHWORK_COLORS.phase_label,
    textAlign: 'center',
  },
  modeName: {
    fontSize: 16,
    color: BREATHWORK_COLORS.circle_inhale,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 180, 197, 0.08)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: BREATHWORK_COLORS.phase_label,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: BREATHWORK_COLORS.timer_text,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0, 180, 197, 0.2)',
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  logButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loggedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 180, 197, 0.12)',
  },
  loggedText: {
    fontSize: 15,
    fontWeight: '600',
    color: BREATHWORK_COLORS.circle_inhale,
  },
  dismissButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 15,
    color: BREATHWORK_COLORS.timer_text,
    fontWeight: '500',
  },
});
