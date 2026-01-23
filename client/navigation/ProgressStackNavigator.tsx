import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProgressScreen from '@/screens/ProgressScreen';
import { useScreenOptions } from '@/hooks/useScreenOptions';

export type ProgressStackParamList = {
  Progress: undefined;
};

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export default function ProgressStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          title: 'Progress',
        }}
      />
    </Stack.Navigator>
  );
}
