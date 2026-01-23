import React, { useState } from 'react';
import { StyleSheet, View, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const { width } = Dimensions.get('window');

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

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const { theme } = useTheme();
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
    <ThemedView style={styles.container}>
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
              style={[styles.description, { color: theme.textSecondary }]}
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
                theme={theme}
              />
            ))}
          </View>

          <Button onPress={handleNext} style={styles.button}>
            {isLastPage ? 'Get Started' : 'Continue'}
          </Button>
        </View>
      </View>
    </ThemedView>
  );
}

function PageDot({ active, theme }: { active: boolean; theme: any }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 15, stiffness: 150 }),
    opacity: withSpring(active ? 1 : 0.4, { damping: 15, stiffness: 150 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: theme.primary },
        animatedStyle,
      ]}
    />
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
  },
  description: {
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
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
  button: {
    width: '100%',
  },
});
