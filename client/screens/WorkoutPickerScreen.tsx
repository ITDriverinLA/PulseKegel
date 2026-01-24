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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';

export default function WorkoutPickerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

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
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Feather name="x" size={24} color="#fff" />
        </Pressable>
        <ThemedText type="h2" style={styles.title}>
          Quick Workout
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ThemedText type="body" style={styles.subtitle}>
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
                pressed && styles.workoutCardPressed,
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
                <ThemedText type="body" style={styles.workoutName}>
                  {workout.name}
                </ThemedText>
                <ThemedText type="small" style={styles.workoutDescription}>
                  {workout.description}
                </ThemedText>
              </View>

              <View style={styles.durationBadge}>
                <Feather name="clock" size={12} color="rgba(255,255,255,0.6)" />
                <ThemedText type="small" style={styles.durationText}>
                  {workout.estimatedMinutes}m
                </ThemedText>
              </View>

              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    textShadowColor: NEON_GREEN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  placeholder: {
    width: 40,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  workoutCardPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: NEON_CYAN,
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
    color: '#fff',
    fontWeight: '600',
    marginBottom: 2,
  },
  workoutDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    gap: 4,
  },
  durationText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
});
