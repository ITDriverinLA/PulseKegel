import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ProgressScreen from "@/screens/ProgressScreen";
import ProgramOverviewScreen from "@/screens/ProgramOverviewScreen";
import ReviewHistoryScreen from "@/screens/ReviewHistoryScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProgressStackParamList = {
  Progress: undefined;
  ProgramOverview: undefined;
  ReviewHistory: undefined;
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
          title: "Progress",
        }}
      />
      <Stack.Screen
        name="ProgramOverview"
        component={ProgramOverviewScreen}
        options={{
          title: "Program",
        }}
      />
      <Stack.Screen
        name="ReviewHistory"
        component={ReviewHistoryScreen}
        options={{
          title: "AI Reviews",
        }}
      />
    </Stack.Navigator>
  );
}
