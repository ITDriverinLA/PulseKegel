import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Crypto from "expo-crypto";

import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_MICRO,
  ANIM_DURATION_RESET_FAST,
} from "@/constants/animation";
import { storage } from "@/lib/storage";
import { getWeek1WorkoutForDayIndex } from "@/data/workoutProgram";
import {
  FirstSessionGateSource,
  trackFirstSessionCtaTapped,
  trackFirstSessionGateShown,
  trackFirstSessionStarted,
} from "@/lib/analytics";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FirstSessionGateScreenProps {
  onUnlocked: () => void;
}

const BLUE = "#00AAFF";
const TEXT = "#F0F2FF";
const TEXT_SEC = "rgba(240,242,255,0.65)";
const TEXT_MUTED = "rgba(240,242,255,0.38)";
const BG_GRADIENT: [string, string, string, string] = [
  "#07081A",
  "#0A0B22",
  "#0D0E28",
  "#070818",
];

const { width } = Dimensions.get("window");

export default function FirstSessionGateScreen({
  onUnlocked,
}: FirstSessionGateScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const [source, setSource] = useState<FirstSessionGateSource>("cold_open");
  const [resume, setResume] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [ready, setReady] = useState(false);
  const gateShownRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const hydrate = useCallback(async () => {
    const [completed, inProgress, celebrated, pendingSource, existingId] =
      await Promise.all([
        storage.hasCompletedFirstSession(),
        storage.isFirstSessionInProgress(),
        storage.hasCelebratedFirstSession(),
        storage.peekFirstSessionGateSource(),
        storage.getFirstSessionId(),
      ]);
    if (existingId) {
      sessionIdRef.current = existingId;
    }

    if (completed) {
      if (!celebrated) {
        setCelebrating(true);
        setReady(true);
        return;
      }
      onUnlocked();
      return;
    }

    let nextSource: FirstSessionGateSource = "cold_open";
    if (inProgress) {
      nextSource = "resume";
      setResume(true);
    } else if (pendingSource) {
      nextSource = pendingSource;
      setResume(false);
    } else {
      setResume(false);
    }
    setSource(nextSource);
    setReady(true);

    if (!gateShownRef.current) {
      gateShownRef.current = true;
      trackFirstSessionGateShown({ source: nextSource });
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (isFocused) {
      void hydrate();
    }
  }, [isFocused, hydrate]);

  const finishCelebration = async () => {
    await storage.markFirstSessionCelebrated();
    setCelebrating(false);
    onUnlocked();
  };

  const handleStart = async () => {
    trackFirstSessionCtaTapped({ source });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const existingStart = await storage.getProgramStartDate();
    if (!existingStart) {
      await storage.setProgramStartDate(todayStr);
    }

    const workout = getWeek1WorkoutForDayIndex(0, null);
    let sessionId = sessionIdRef.current ?? (await storage.getFirstSessionId());
    if (!sessionId) {
      sessionId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${todayStr}-${Date.now()}`,
      ).catch(() => `fs-${Date.now()}`);
    }
    sessionIdRef.current = sessionId;

    await storage.setFirstSessionId(sessionId);
    await storage.setFirstSessionInProgress(true, 0);
    await storage.clearFirstSessionGateSource();
    trackFirstSessionStarted({ session_id: sessionId });

    navigation.navigate("WorkoutPlayer", {
      workout,
      weekNumber: 1,
      phase: "Control",
      dayNumber: 1,
      isFirstSession: true,
      firstSessionId: sessionId,
    });
  };

  if (!ready) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  if (celebrating) {
    return (
      <View
        style={[
          styles.root,
          styles.centered,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: Spacing.xl,
          },
        ]}
      >
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
        <View style={styles.badge}>
          <Feather name="check-circle" size={42} color={BLUE} />
        </View>
        <Text style={styles.headline}>Nice work — Day 1 done.</Text>
        <Text style={styles.subline}>
          Your full program is unlocked. Come back tomorrow for Day 2.
        </Text>
        <PrimaryButton
          label="Continue"
          onPress={() => {
            void finishCelebration();
          }}
          testID="button-first-session-celebration-continue"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: Spacing.xl,
        },
      ]}
    >
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.logoText}>
          <Text style={{ color: TEXT }}>PULSE</Text>
          <Text style={{ color: BLUE }}>KEGEL</Text>
        </Text>
        <Text style={styles.kicker}>DAY 1</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.ring}>
          <Feather name="play" size={36} color={BLUE} />
        </View>
        <Text style={styles.headline}>
          {resume ? "Resume your first session" : "Start your first session"}
        </Text>
        <Text style={styles.subline}>
          We will keep this short and clear. One guided session — then the full
          menu opens.
        </Text>
        <Text style={styles.meta}>About 5–8 minutes · Coach cues only</Text>
      </View>

      <PrimaryButton
        label={resume ? "Resume Day 1" : "Start your first session"}
        onPress={() => {
          void handleStart();
        }}
        testID="button-first-session-cta"
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.primaryBtnWrapper, animStyle]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.97, {
            duration: ANIM_DURATION_RESET_FAST,
          });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: ANIM_DURATION_MICRO });
        }}
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryBtnText}>{label}</Text>
        <Feather
          name="chevron-right"
          size={18}
          color="#fff"
          style={{ marginLeft: 4 }}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  kicker: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: BLUE,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 14,
  },
  ring: {
    width: Math.min(width * 0.28, 120),
    height: Math.min(width * 0.28, 120),
    borderRadius: 999,
    borderWidth: 2,
    borderColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,170,255,0.12)",
    marginBottom: 8,
  },
  badge: {
    alignItems: "center",
    marginBottom: 18,
  },
  headline: {
    fontSize: 26,
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
    lineHeight: 34,
  },
  subline: {
    fontSize: 16,
    color: TEXT_SEC,
    textAlign: "center",
    lineHeight: 24,
  },
  meta: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 4,
  },
  primaryBtnWrapper: {
    width: "100%",
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: BLUE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
});
