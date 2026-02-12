import React from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import { standaloneWorkouts, StandaloneWorkout } from '@/data/standaloneWorkouts';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutPickerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { cp, isDarkMode } = useThemePreference();

  const handleSelectWorkout = (workout: StandaloneWorkout) => {
    navigation.navigate('WorkoutPlayer', {
      workout: workout.workout,
      weekNumber: 0,
      phase: 'Quick Workout',
    });
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleClose} style={[styles.closeButton, { backgroundColor: cp.cardBorder }]}>
          <Feather name="x" size={24} color={cp.text} />
        </Pressable>
        <ThemedText type="h2" style={[styles.title, { color: cp.text, textShadowColor: isDarkMode ? cp.neonGreen : 'transparent' }]}>
          Quick Workout
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ThemedText type="body" style={[styles.subtitle, { color: cp.textSecondary }]}>
        Choose a workout to start right now
      </ThemedText>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {standaloneWorkouts.map((workout, index) => (
          <Animated.View
            key={workout.id}
            entering={FadeInDown.duration(400).delay(index * 80)}
          >
            <Pressable
              style={({ pressed }) => [
                styles.workoutCard,
                { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
                pressed && { backgroundColor: cp.cardBorder, borderColor: cp.neonCyan },
              ]}
              onPress={() => handleSelectWorkout(workout)}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${workout.accentColor}20` },
                ]}
              >
                <Feather
                  name={workout.icon as any}
                  size={24}
                  color={workout.accentColor}
                />
              </View>
              
              <View style={styles.workoutInfo}>
                <ThemedText type="body" style={[styles.workoutName, { color: cp.text }]}>
                  {workout.name}
                </ThemedText>
                <ThemedText type="small" style={[styles.workoutDescription, { color: cp.textMuted }]}>
                  {workout.description}
                </ThemedText>
              </View>

              <View style={[styles.durationBadge, { backgroundColor: cp.inputBg }]}>
                <Feather name="clock" size={12} color={cp.textSecondary} />
                <ThemedText type="small" style={[styles.durationText, { color: cp.textSecondary }]}>
                  {workout.estimatedMinutes}m
                </ThemedText>
              </View>

              <Feather name="chevron-right" size={20} color={cp.textMuted} />
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  placeholder: {
    width: 40,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  workoutDescription: {
    fontSize: 12,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
  },
});
