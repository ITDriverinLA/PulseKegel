import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SettingsScreen from "@/screens/SettingsScreen";
import TransferChecklistScreen from "@/screens/TransferChecklistScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SettingsStackParamList = {
  Settings: undefined;
  TransferChecklist: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="TransferChecklist"
        component={TransferChecklistScreen}
        options={{
          title: "Moving to a new phone?",
        }}
      />
    </Stack.Navigator>
  );
}
