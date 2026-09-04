import React, { useCallback } from "react";
import {
  createBottomTabNavigator,
  type BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import ProgressStackNavigator from "@/navigation/ProgressStackNavigator";
import SettingsStackNavigator from "@/navigation/SettingsStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { storage } from "@/lib/storage";

export type MainTabParamList = {
  TodayTab: undefined;
  ProgressTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const shouldOpen = await storage.consumePendingOpenSettings();
        if (!cancelled && shouldOpen) {
          navigation.navigate("SettingsTab");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [navigation]),
  );

  return (
    <Tab.Navigator
      initialRouteName="TodayTab"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="TodayTab"
        component={HomeStackNavigator}
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Feather name="play-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressStackNavigator}
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
