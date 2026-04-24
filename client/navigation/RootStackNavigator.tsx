import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabNavigator from '@/navigation/MainTabNavigator';
import WorkoutPlayerScreen from '@/screens/WorkoutPlayerScreen';
import WorkoutPickerScreen from '@/screens/WorkoutPickerScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import ChallengeCompleteScreen from '@/screens/ChallengeCompleteScreen';
import MusicScreen from '@/screens/MusicScreen';
import BreathworkModeSelectorScreen from '@/screens/BreathworkModeSelectorScreen';
import BreathworkSessionScreen from '@/screens/BreathworkSessionScreen';
import BreathworkSummaryScreen from '@/screens/BreathworkSummaryScreen';
import TechniqueGuideScreen from '@/screens/TechniqueGuideScreen';
import { useScreenOptions } from '@/hooks/useScreenOptions';
import { storage } from '@/lib/storage';
import { DayTemplate } from '@/data/workoutProgram';
import { BreathworkMode } from '@/constants/breathworkModes';

export type RootStackParamList = {
  Main: undefined;
  WorkoutPlayer: {
    workout: DayTemplate;
    weekNumber: number;
    phase: string;
  };
  WorkoutPicker: undefined;
  Onboarding: undefined;
  Paywall: undefined;
  ChallengeComplete: undefined;
  Music: undefined;
  BreathworkModeSelector: undefined;
  BreathworkSession: { mode: BreathworkMode };
  BreathworkSummary: { mode: BreathworkMode; completed: boolean };
  TechniqueGuide: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    const isComplete = await storage.isOnboardingComplete();
    setShowOnboarding(!isComplete);
    setIsLoading(false);
  };

  const handleOnboardingComplete = async () => {
    await storage.setOnboardingComplete();
    setShowOnboarding(false);
  };

  if (isLoading) {
    return null;
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WorkoutPlayer"
        component={WorkoutPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="WorkoutPicker"
        component={WorkoutPickerScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ChallengeComplete"
        component={ChallengeCompleteScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Music"
        component={MusicScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BreathworkModeSelector"
        component={BreathworkModeSelectorScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BreathworkSession"
        component={BreathworkSessionScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="BreathworkSummary"
        component={BreathworkSummaryScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="TechniqueGuide"
        component={TechniqueGuideScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
