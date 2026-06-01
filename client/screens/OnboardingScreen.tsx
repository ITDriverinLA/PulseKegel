import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Image,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  Animated as RNAnimated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import {
  ANIM_DURATION_HOLD_PULSE,
  ANIM_DURATION_MICRO,
  ANIM_DURATION_RESET_FAST,
  ANIM_EASING_PULSE,
} from "@/constants/animation";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, AnatomyType } from "@/lib/storage";
import { trackOnboardingComplete } from "@/lib/analytics";

interface OnboardingScreenProps {
  onComplete: () => void;
}

const { width, height } = Dimensions.get("window");

const MAN_HERO = require("../../assets/images/onboarding/male-hero.png");
const WOMAN_HERO = require("../../assets/images/onboarding/female-hero.png");
const MALE_STEP1 = require("../../assets/images/onboarding/male-anatomy-step1.png");
const MALE_STEP2 = require("../../assets/images/onboarding/male-anatomy-step2.png");
const FEMALE_STEP1 = require("../../assets/images/onboarding/female-anatomy-step1.png");
const FEMALE_STEP2 = require("../../assets/images/onboarding/female-anatomy-step2.png");

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
const BG_GRADIENT: [string, string, string, string] = [
  "#07081A",
  "#0A0B22",
  "#0D0E28",
  "#070818",
];

type Step = "gender" | "knowledge" | "tutorial" | "cta";

export default function OnboardingScreen({
  onComplete,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = React.useState<Step>("gender");
  const [gender, setGender] = React.useState<AnatomyType>(null);

  const screenOpacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const fadeToStep = (next: Step) => {
    RNAnimated.sequence([
      RNAnimated.timing(screenOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(next);
      RNAnimated.timing(screenOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleGenderSelect = (g: "male" | "female") => {
    setGender(g);
    fadeToStep("knowledge");
  };

  const handleKnowledge = (knows: boolean) => {
    if (knows) {
      fadeToStep("cta");
    } else {
      fadeToStep("tutorial");
    }
  };

  const handleTutorialDone = () => {
    fadeToStep("cta");
  };

  const handleStart = async () => {
    await storage.saveSettings({ anatomyType: gender });
    trackOnboardingComplete({ anatomyType: gender });
    await storage.setOnboardingComplete();
    onComplete();
  };

  const accent = gender === "female" ? PINK : BLUE;
  const accentDim = gender === "female" ? PINK_DIM : BLUE_DIM;
  const accentBorder = gender === "female" ? PINK_BORDER : BLUE_BORDER;

  return (
    <RNAnimated.View style={[styles.root, { opacity: screenOpacity }]}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />

      {step === "gender" && (
        <GenderScreen insets={insets} onSelect={handleGenderSelect} />
      )}
      {step === "knowledge" && (
        <KnowledgeScreen
          insets={insets}
          accent={accent}
          onAnswer={handleKnowledge}
        />
      )}
      {step === "tutorial" && (
        <TutorialScreen
          insets={insets}
          gender={gender}
          accent={accent}
          accentDim={accentDim}
          accentBorder={accentBorder}
          onDone={handleTutorialDone}
        />
      )}
      {step === "cta" && (
        <CtaScreen
          insets={insets}
          gender={gender}
          accent={accent}
          accentDim={accentDim}
          onStart={handleStart}
        />
      )}
    </RNAnimated.View>
  );
}

function GenderScreen({
  insets,
  onSelect,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  onSelect: (g: "male" | "female") => void;
}) {
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.genderHeader}>
        <Text style={styles.logoText}>
          <Text style={{ color: TEXT }}>PULSE</Text>
          <Text style={{ color: BLUE }}>KEGEL</Text>
        </Text>
        <Text style={styles.logoTagline}>STRONGER. CONFIDENT. IN CONTROL.</Text>
      </View>

      <View style={styles.genderHeroRow}>
        <Image
          source={MAN_HERO}
          style={styles.genderHeroImage}
          resizeMode="cover"
        />
        <Image
          source={WOMAN_HERO}
          style={[styles.genderHeroImage, { marginLeft: -8 }]}
          resizeMode="cover"
        />
      </View>

      <View style={styles.genderTextBlock}>
        <Text style={styles.genderHeadline}>
          Most people lose strength in their pelvic floor over time.
        </Text>
        <Text style={styles.genderSubline}>
          You can train it — and you should.
        </Text>
        <Text style={[styles.genderCta, { color: BLUE }]}>
          {"Let's get started."}
        </Text>
      </View>

      <View style={styles.genderButtons}>
        <GenderButton
          label="I'm a Man"
          icon="male"
          color={BLUE}
          dimColor={BLUE_DIM}
          borderColor={BLUE_BORDER}
          onPress={() => onSelect("male")}
          testID="button-gender-man"
        />
        <GenderButton
          label="I'm a Woman"
          icon="female"
          color={PINK}
          dimColor={PINK_DIM}
          borderColor={PINK_BORDER}
          onPress={() => onSelect("female")}
          testID="button-gender-woman"
        />
      </View>

      <View style={styles.footer}>
        <Feather name="lock" size={11} color={TEXT_MUTED} />
        <Text style={styles.footerText}>Private. Secure. Just for you.</Text>
      </View>
    </View>
  );
}

function GenderButton({
  label,
  icon,
  color,
  dimColor,
  borderColor,
  onPress,
  testID,
}: {
  label: string;
  icon: string;
  color: string;
  dimColor: string;
  borderColor: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.genderBtn,
        {
          backgroundColor: pressed ? color + "22" : dimColor,
          borderColor: pressed ? color : borderColor,
        },
      ]}
    >
      <Text style={[styles.genderBtnSymbol, { color }]}>
        {icon === "male" ? "♂" : "♀"}
      </Text>
      <Text style={[styles.genderBtnLabel, { color }]}>{label}</Text>
      <Feather
        name="chevron-right"
        size={18}
        color={color}
        style={{ marginLeft: "auto" }}
      />
    </Pressable>
  );
}

function KnowledgeScreen({
  insets,
  accent,
  onAnswer,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  accent: string;
  onAnswer: (knows: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, {
          duration: ANIM_DURATION_HOLD_PULSE,
          easing: ANIM_EASING_PULSE,
        }),
        withTiming(1.0, {
          duration: ANIM_DURATION_HOLD_PULSE,
          easing: ANIM_EASING_PULSE,
        }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ANIM_DURATION_HOLD_PULSE,
          easing: ANIM_EASING_PULSE,
        }),
        withTiming(0.4, {
          duration: ANIM_DURATION_HOLD_PULSE,
          easing: ANIM_EASING_PULSE,
        }),
      ),
      -1,
      false,
    );
  }, [scale, glow]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: glow.value,
  }));

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const CIRCLE_SIZE = Math.min(width * 0.52, 220);

  return (
    <View
      style={[
        styles.screen,
        styles.centered,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.knowledgeLogo}>
        <Text style={styles.logoText}>
          <Text style={{ color: TEXT }}>PULSE</Text>
          <Text style={{ color: accent }}>KEGEL</Text>
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Animated.View
            style={[
              styles.qGlow,
              {
                width: CIRCLE_SIZE + 40,
                height: CIRCLE_SIZE + 40,
                borderRadius: (CIRCLE_SIZE + 40) / 2,
                shadowColor: accent,
              },
              ringStyle,
            ]}
          />
          <Animated.View style={[circleStyle, { position: "absolute" }]}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={CIRCLE_SIZE / 2 - 3}
                stroke={accent}
                strokeWidth={2.5}
                fill="rgba(0,0,0,0.35)"
              />
              <SvgText
                x={CIRCLE_SIZE / 2}
                y={CIRCLE_SIZE / 2 + 28}
                textAnchor="middle"
                fontSize={CIRCLE_SIZE * 0.52}
                fontWeight="300"
                fill={accent}
              >
                ?
              </SvgText>
            </Svg>
          </Animated.View>
        </View>

        <Text style={styles.knowledgeHeadline}>
          Do you know how to do Kegels?
        </Text>

        <View style={styles.knowledgeButtons}>
          <OptionButton
            icon="check"
            label="Yes, I know how"
            accent={accent}
            onPress={() => onAnswer(true)}
            testID="button-knows-yes"
          />
          <OptionButton
            icon="x"
            label="No, show me how"
            accent={TEXT_MUTED}
            onPress={() => onAnswer(false)}
            testID="button-knows-no"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Feather name="shield" size={11} color={TEXT_MUTED} />
        <Text style={styles.footerText}>Takes less than 1 minute</Text>
      </View>
    </View>
  );
}

function OptionButton({
  icon,
  label,
  accent,
  onPress,
  testID,
}: {
  icon: "check" | "x";
  label: string;
  accent: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionBtn,
        {
          backgroundColor: pressed ? "rgba(255,255,255,0.08)" : CARD_BG,
          borderColor: pressed ? accent : CARD_BORDER,
        },
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          { backgroundColor: accent + "22", borderColor: accent + "55" },
        ]}
      >
        <Feather name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.optionLabel, { color: TEXT }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={TEXT_MUTED} />
    </Pressable>
  );
}

function TutorialScreen({
  insets,
  gender,
  accent,
  accentDim,
  accentBorder,
  onDone,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  gender: AnatomyType;
  accent: string;
  accentDim: string;
  accentBorder: string;
  onDone: () => void;
}) {
  const isMale = gender !== "female";

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

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.tutorialScroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.tutorialHeadline}>How to do Kegels</Text>

        <View
          style={[
            styles.genderPill,
            { backgroundColor: accentDim, borderColor: accentBorder },
          ]}
        >
          <Text style={[styles.genderPillText, { color: accent }]}>
            {isMale ? "For Men" : "For Women"}
          </Text>
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

        <View style={styles.dotRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === 1
                  ? { backgroundColor: accent, width: 20 }
                  : { backgroundColor: TEXT_MUTED, width: 8 },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.tutorialFooter}>
        <PrimaryButton
          label="Got it — Let's begin"
          accent={accent}
          onPress={onDone}
          testID="button-tutorial-done"
        />
      </View>
    </View>
  );
}

function CtaScreen({
  insets,
  gender,
  accent,
  accentDim,
  onStart,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  gender: AnatomyType;
  accent: string;
  accentDim: string;
  onStart: () => void;
}) {
  const isMale = gender !== "female";

  const headline = isMale
    ? "Your pelvic floor affects your bladder control, confidence, and performance."
    : "Your pelvic floor affects bladder control, core strength, and intimacy.";

  const subline = isMale
    ? "Most men never train it."
    : "Most women only start training it after they notice a problem.";

  const benefits = isMale
    ? [
        {
          icon: "shield" as const,
          label: "Control",
          sub: "Stronger bladder control",
        },
        {
          icon: "user" as const,
          label: "Confidence",
          sub: "Feel ready every day",
        },
        {
          icon: "zap" as const,
          label: "Performance",
          sub: "Show up at your best",
        },
      ]
    : [
        {
          icon: "shield" as const,
          label: "Control",
          sub: "Feel confident every day",
        },
        {
          icon: "layers" as const,
          label: "Core",
          sub: "Stronger from the inside out",
        },
        {
          icon: "heart" as const,
          label: "Intimacy",
          sub: "Stronger connection, more confidence",
        },
      ];

  const HERO_H = Math.min(height * 0.32, 280);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.ctaScroll,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.ctaLogoRow}>
        <Text style={styles.logoText}>
          <Text style={{ color: TEXT }}>PULSE</Text>
          <Text style={{ color: accent }}>KEGEL</Text>
        </Text>
      </View>

      <Image
        source={isMale ? MAN_HERO : WOMAN_HERO}
        style={[styles.ctaHero, { height: HERO_H }]}
        resizeMode="cover"
      />

      <View style={styles.ctaTextBlock}>
        <Text style={styles.ctaHeadline}>{headline}</Text>
        <Text style={[styles.ctaSubline, { color: accent }]}>{subline}</Text>
      </View>

      <View style={styles.benefitsRow}>
        {benefits.map((b) => (
          <View key={b.label} style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: accentDim }]}>
              <Feather name={b.icon} size={18} color={accent} />
            </View>
            <Text style={styles.benefitLabel}>{b.label}</Text>
            <Text style={styles.benefitSub}>{b.sub}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaButtonBlock}>
        <PrimaryButton
          label="Start My 7-Day Challenge"
          accent={accent}
          icon="send"
          onPress={onStart}
          testID="button-start-challenge"
        />
        <View style={styles.footer}>
          <Feather name="lock" size={11} color={TEXT_MUTED} />
          <Text style={styles.footerText}>
            Takes less than 5 minutes a day. Your data stays private.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function PrimaryButton({
  label,
  accent,
  icon,
  onPress,
  testID,
}: {
  label: string;
  accent: string;
  icon?: string;
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
        style={[
          styles.primaryBtn,
          { backgroundColor: accent, shadowColor: accent },
        ]}
      >
        {icon ? (
          <Feather
            name={icon as "send"}
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
        ) : null}
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
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  centered: {
    alignItems: "stretch",
  },

  logoText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  logoTagline: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.8,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 2,
  },

  // Gender screen
  genderHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  genderHeroRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    flex: 1,
    overflow: "hidden",
    borderRadius: BorderRadius.lg,
    marginHorizontal: -Spacing.xl,
  },
  genderHeroImage: {
    width: "50%",
    height: "100%",
  },
  genderTextBlock: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  genderHeadline: {
    fontSize: 24,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    lineHeight: 32,
  },
  genderSubline: {
    fontSize: 16,
    color: TEXT_SEC,
    textAlign: "center",
    marginTop: 8,
  },
  genderCta: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  genderButtons: {
    gap: 12,
    marginBottom: 16,
  },
  genderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: 12,
  },
  genderBtnSymbol: {
    fontSize: 22,
    fontWeight: "300",
    width: 26,
    textAlign: "center",
  },
  genderBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
  },

  // Knowledge screen
  knowledgeLogo: {
    alignItems: "center",
    marginBottom: 16,
  },
  knowledgeHeadline: {
    fontSize: 26,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    marginTop: 36,
    lineHeight: 34,
    paddingHorizontal: 8,
  },
  qGlow: {
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 32,
    elevation: 20,
    backgroundColor: "transparent",
  },
  knowledgeButtons: {
    gap: 12,
    marginTop: 36,
    width: "100%",
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 14,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },

  // Tutorial screen
  tutorialScroll: {
    paddingBottom: 16,
    gap: 16,
    alignItems: "center",
  },
  tutorialHeadline: {
    fontSize: 28,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    marginTop: 8,
  },
  genderPill: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  genderPillText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
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
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  tutorialFooter: {
    paddingTop: 12,
    paddingBottom: 4,
  },

  // CTA screen
  ctaScroll: {
    paddingHorizontal: Spacing.xl,
    gap: 20,
  },
  ctaLogoRow: {
    alignItems: "center",
    marginBottom: 4,
  },
  ctaHero: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  ctaTextBlock: {
    alignItems: "center",
    gap: 10,
  },
  ctaHeadline: {
    fontSize: 24,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    lineHeight: 32,
  },
  ctaSubline: {
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    fontWeight: "500",
  },
  benefitsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8,
  },
  benefitItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
  },
  benefitSub: {
    fontSize: 11,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 15,
  },
  ctaButtonBlock: {
    gap: 16,
  },

  // Primary button
  primaryBtnWrapper: {
    width: "100%",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: BorderRadius.full,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: "center",
  },
});
