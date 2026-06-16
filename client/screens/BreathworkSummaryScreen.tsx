import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  getModeConfig,
  getBreathworkColors,
} from "@/constants/breathworkModes";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import {
  ANIM_DURATION_CONTENT_SLOW,
  ANIM_DELAY_SHORT,
  ANIM_DELAY_MED,
  ANIM_DELAY_LONG,
} from "@/constants/animation";
import { storage } from "@/lib/storage";
import { todayDateString } from "@/lib/controlScore";
import { rescheduleAfterCompletion } from "@/lib/notifications";
import { isRestDayForDate } from "@/data/workoutProgram";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SummaryRoute = RouteProp<RootStackParamList, "BreathworkSummary">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BreathworkSummaryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SummaryRoute>();
  const { mode } = route.params;
  const config = getModeConfig(mode);
  const [logged, setLogged] = useState(false);
  const { theme } = useThemePreference();
  const bwColors = getBreathworkColors(theme);

  const handleLogSession = async () => {
    const now = new Date();
    const today = todayDateString(now);
    await storage.addCompletedDate(today, 5);
    setLogged(true);
    await rescheduleAfterCompletion();

    const programStartDate = await storage.getProgramStartDate();
    if (programStartDate) {
      const startParts = programStartDate.split("-").map(Number);
      const startDateObj = new Date(
        startParts[0],
        startParts[1] - 1,
        startParts[2],
      );
      const daysSinceStart = Math.floor(
        (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
          startDateObj.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceStart < 7 && isRestDayForDate(now, programStartDate)) {
        await storage.markChallengeOptionalSession(today);
      }
    }
  };

  const handleDismiss = () => {
    navigation.popToTop();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bwColors.bg_session,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <View style={styles.content}>
        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT_SLOW)}
          style={styles.iconContainer}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: bwColors.accentSoft },
            ]}
          >
            <Feather name="check-circle" size={64} color={bwColors.accent} />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT_SLOW).delay(
            ANIM_DELAY_SHORT,
          )}
        >
          <Text style={[styles.title, { color: bwColors.phase_label }]}>
            Session Complete
          </Text>
          <Text style={[styles.modeName, { color: bwColors.accent }]}>
            {config.name}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT_SLOW).delay(
            ANIM_DELAY_MED,
          )}
          style={[styles.statsRow, { backgroundColor: bwColors.accentSoft }]}
        >
          <View style={styles.statItem}>
            <Feather name="clock" size={20} color={bwColors.accent} />
            <Text style={[styles.statValue, { color: bwColors.phase_label }]}>
              5:00
            </Text>
            <Text style={[styles.statLabel, { color: bwColors.timer_text }]}>
              Duration
            </Text>
          </View>
          <View
            style={[
              styles.statDivider,
              { backgroundColor: bwColors.accentSoft },
            ]}
          />
          <View style={styles.statItem}>
            <Feather name="wind" size={20} color={bwColors.accent} />
            <Text style={[styles.statValue, { color: bwColors.phase_label }]}>
              {config.subtitle}
            </Text>
            <Text style={[styles.statLabel, { color: bwColors.timer_text }]}>
              Technique
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT_SLOW).delay(
            ANIM_DELAY_LONG,
          )}
          style={styles.buttonsContainer}
        >
          {logged ? (
            <View
              style={[
                styles.loggedContainer,
                { backgroundColor: bwColors.accentSoft },
              ]}
            >
              <Feather name="check" size={20} color={bwColors.accent} />
              <Text style={[styles.loggedText, { color: bwColors.accent }]}>
                Session logged to your streak
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={handleLogSession}
              testID="breathwork-log-button"
            >
              <LinearGradient
                colors={bwColors.logButtonGradient}
                style={styles.logButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Feather name="plus-circle" size={20} color="#FFFFFF" />
                <Text style={styles.logButtonText}>Log Session</Text>
              </LinearGradient>
            </Pressable>
          )}

          <Pressable
            onPress={handleDismiss}
            style={styles.dismissButton}
            testID="breathwork-dismiss-button"
          >
            <Text style={[styles.dismissText, { color: bwColors.timer_text }]}>
              {logged ? "Done" : "Skip"}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  modeName: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  buttonsContainer: {
    width: "100%",
    gap: 12,
  },
  logButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  logButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loggedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  loggedText: {
    fontSize: 15,
    fontWeight: "600",
  },
  dismissButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  dismissText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
