import React, { useState } from 'react';
import { StyleSheet, View, Image, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
  useSharedValue,
  WithSpringConfig,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const { width } = Dimensions.get('window');

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';

const pages = [
  {
    image: require('../../assets/images/onboarding-welcome.png'),
    title: 'Welcome to PulseKegel',
    description:
      'Build pelvic floor strength with guided daily workouts. Visual cues and haptic feedback help you train effectively.',
  },
  {
    image: require('../../assets/images/onboarding-safety.png'),
    title: 'Safety First',
    description:
      'This app is for wellness purposes only and is not medical advice. Stop immediately if you experience pain, urinary urgency, or pelvic pressure.',
  },
  {
    image: require('../../assets/images/icon.png'),
    title: 'Your 12-Week Journey',
    description:
      'Progress through phases of control, strength, power, and maintenance. Each workout adapts to your current level.',
  },
];

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const insets = useSafeAreaInsets();

  const isLastPage = currentPage === pages.length - 1;

  const handleNext = () => {
    if (isLastPage) {
      onComplete();
    } else {
      setCurrentPage(prev => prev + 1);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing['3xl'],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.pageContent}>
          <Animated.View
            key={currentPage}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={styles.imageContainer}
          >
            <Image
              source={pages[currentPage].image}
              style={styles.image}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View
            key={`text-${currentPage}`}
            entering={FadeIn.duration(300).delay(100)}
            style={styles.textContainer}
          >
            <ThemedText type="h1" style={styles.title}>
              {pages[currentPage].title}
            </ThemedText>
            <ThemedText
              type="body"
              style={styles.description}
            >
              {pages[currentPage].description}
            </ThemedText>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {pages.map((_, index) => (
              <PageDot
                key={index}
                active={index === currentPage}
              />
            ))}
          </View>

          <NeonButton onPress={handleNext}>
            {isLastPage ? 'Get Started' : 'Continue'}
          </NeonButton>
        </View>
      </View>
    </View>
  );
}

function PageDot({ active }: { active: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 15, stiffness: 150 }),
    opacity: withSpring(active ? 1 : 0.4, { damping: 15, stiffness: 150 }),
  }));

  return (
    <View style={active ? styles.dotGlow : undefined}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: NEON_GREEN },
          animatedStyle,
        ]}
      />
    </View>
  );
}

function NeonButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.buttonWrapper, animatedStyle]}
    >
      <View style={styles.buttonGlow}>
        <LinearGradient
          colors={[NEON_GREEN, NEON_CYAN, NEON_GREEN]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <ThemedText type="body" style={styles.buttonText}>
            {children}
          </ThemedText>
        </LinearGradient>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  pageContent: {
    flex: 1,
    justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  image: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: BorderRadius.xl,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
    color: '#fff',
  },
  description: {
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
    color: 'rgba(255,255,255,0.6)',
  },
  footer: {
    paddingBottom: Spacing.lg,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotGlow: {
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonWrapper: {
    width: '100%',
  },
  buttonGlow: {
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    color: '#000',
  },
});
