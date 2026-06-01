import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Image,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, AnatomyType } from "@/lib/storage";
import {
  ANIM_DURATION_RESET_FAST,
  ANIM_DURATION_MICRO,
} from "@/constants/animation";

const { height } = Dimensions.get("window");

const MALE_STEP1 = require("../assets/images/onboarding/male-anatomy-step1.png");
const MALE_STEP2 = require("../assets/images/onboarding/male-anatomy-step2.png");
const FEMALE_STEP1 = require("../assets/images/onboarding/female-anatomy-step1.png");
const FEMALE_STEP2 = require("../assets/images/onboarding/female-anatomy-step2.png");

const BLUE = "#00AAFF";
const BLUE_DIM = "rgba(0,170,255,0.15)";
const BLUE_BORDER = "rgba(0,170,255,0.4)";
const PINK = "#FF2D78";
const PINK_DIM = "rgba(255,45,120,0.15)";
const PINK_BORDER = "rgba(255,45,120,0.4)";
const CARD_BG = "rgba(255,255,255,0.06)";
const CARD_BORDER = "rgba(255,255,255,0.1)";
const TEXT = "#F0F2FF";
const TEXT_SEC = "rgba(240,242,255,0.65)";
const TEXT_MUTED = "rgba(240,242,255,0.38)";

export default function KegelsGuideScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [anatomyType, setAnatomyType] = useState<AnatomyType>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storage.getSettings().then((s) => {
      setAnatomyType(s.anatomyType);
      setLoaded(true);
    });
  }, []);

  const isMale = anatomyType !== "female";
  const accent = anatomyType === "female" ? PINK : BLUE;
  const accentDim = anatomyType === "female" ? PINK_DIM : BLUE_DIM;
  const accentBorder = anatomyType === "female" ? PINK_BORDER : BLUE_BORDER;

  const steps = isMale
    ? [
        {
          image: MALE_STEP1,
          title: "Find the muscle",
          body: "Squeeze the same muscle you use to stop your pee mid-flow.",
        },
        {
          image: MALE_STEP2,
          title: "Activate it",
          body: "Now lift your balls upward using just that muscle. That's a Kegel. No one can see you doing it.",
        },
      ]
    : [
        {
          image: FEMALE_STEP1,
          title: "Find the muscle",
          body: "Gently squeeze the same muscles you use to stop the flow of urine.",
        },
        {
          image: FEMALE_STEP2,
          title: "Activate it",
          body: "Now slowly draw that area upward and inward — like you're lifting a marble inside you. That's a Kegel.",
        },
      ];

  const STEP_IMAGE_H = Math.min(height * 0.2, 160);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!loaded) {
    return (
      <LinearGradient
        colors={["#07081A", "#0A0B22", "#0D0E28", "#070818"]}
        style={styles.container}
      />
    );
  }

  return (
    <LinearGradient
      colors={["#07081A", "#0A0B22", "#0D0E28", "#070818"]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          testID="button-kegels-guide-back"
        >
          <Feather name="x" size={22} color={TEXT} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>How to do Kegels</Text>

        <View style={styles.pillRow}>
          <Pressable
            onPress={() => setAnatomyType("male")}
            style={[
              styles.pill,
              isMale
                ? { backgroundColor: BLUE_DIM, borderColor: BLUE_BORDER }
                : { backgroundColor: "transparent", borderColor: CARD_BORDER },
            ]}
            testID="button-kegels-guide-male"
          >
            <Text
              style={[styles.pillText, { color: isMale ? BLUE : TEXT_MUTED }]}
            >
              For Men
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setAnatomyType("female")}
            style={[
              styles.pill,
              !isMale
                ? { backgroundColor: PINK_DIM, borderColor: PINK_BORDER }
                : { backgroundColor: "transparent", borderColor: CARD_BORDER },
            ]}
            testID="button-kegels-guide-female"
          >
            <Text
              style={[styles.pillText, { color: !isMale ? PINK : TEXT_MUTED }]}
            >
              For Women
            </Text>
          </Pressable>
        </View>

        {steps.map((s, idx) => (
          <View
            key={idx}
            style={[
              styles.stepCard,
              { backgroundColor: CARD_BG, borderColor: CARD_BORDER },
            ]}
          >
            <Image
              source={s.image}
              style={[styles.stepImage, { height: STEP_IMAGE_H }]}
              resizeMode="cover"
            />
            <View style={styles.stepBody}>
              <View
                style={[
                  styles.stepBadge,
                  { backgroundColor: accentDim, borderColor: accentBorder },
                ]}
              >
                <Text style={[styles.stepBadgeText, { color: accent }]}>
                  {idx + 1}
                </Text>
              </View>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepDesc}>{s.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.tipCard}>
          <Feather
            name="info"
            size={16}
            color={accent}
            style={{ marginTop: 2 }}
          />
          <Text style={styles.tipText}>
            {isMale
              ? "Never hold your breath or tighten your stomach, buttocks, or thigh muscles while doing Kegels."
              : "Avoid squeezing your buttocks, thighs, or abdomen. The movement should be internal and subtle."}
          </Text>
        </View>

        <Animated.View style={animStyle}>
          <Pressable
            testID="button-kegels-guide-done"
            onPress={() => navigation.goBack()}
            onPressIn={() => {
              scale.value = withTiming(0.97, {
                duration: ANIM_DURATION_RESET_FAST,
              });
            }}
            onPressOut={() => {
              scale.value = withTiming(1, { duration: ANIM_DURATION_MICRO });
            }}
            style={[
              styles.doneButton,
              { backgroundColor: accent, shadowColor: accent },
            ]}
          >
            <Text style={styles.doneButtonText}>Got it</Text>
            <Feather
              name="check"
              size={18}
              color="#fff"
              style={{ marginLeft: 8 }}
            />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: 16,
    alignItems: "center",
  },
  headline: {
    fontSize: 28,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: "row",
    gap: 10,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  stepCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  stepImage: {
    width: "100%",
  },
  stepBody: {
    padding: 16,
    gap: 6,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
  },
  stepDesc: {
    fontSize: 14,
    color: TEXT_SEC,
    lineHeight: 20,
  },
  tipCard: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 14,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_SEC,
    lineHeight: 19,
  },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: BorderRadius.full,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
