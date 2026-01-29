import React, { useState } from 'react';
import { StyleSheet, View, Image, Dimensions, Pressable, TextInput } from 'react-native';
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
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, AnatomyType } from '@/lib/storage';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const { width } = Dimensions.get('window');

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';

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
    type: 'name',
    title: "What's Your Name?",
    description:
      "We'll use your name to personalize your weekly progress updates.",
  },
  {
    type: 'anatomy',
    title: 'Personalize Your Experience',
    description:
      'Select your anatomy type to receive tailored health insights and exercise guidance.',
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
  const [selectedAnatomy, setSelectedAnatomy] = useState<AnatomyType>(null);
  const [userName, setUserName] = useState('');
  const insets = useSafeAreaInsets();

  const isLastPage = currentPage === pages.length - 1;
  const isAnatomyPage = pages[currentPage].type === 'anatomy';
  const isNamePage = pages[currentPage].type === 'name';

  const handleNext = async () => {
    if (isLastPage) {
      onComplete();
    } else {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleNameSubmit = async () => {
    if (userName.trim()) {
      await storage.saveSettings({ userName: userName.trim() });
    }
    setCurrentPage(prev => prev + 1);
  };

  const handleAnatomySelect = async (type: AnatomyType) => {
    setSelectedAnatomy(type);
    await storage.saveSettings({ anatomyType: type });
    setCurrentPage(prev => prev + 1);
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
          {isNamePage ? (
            <Animated.View
              key={currentPage}
              entering={FadeIn.duration(300)}
              style={styles.nameContainer}
            >
              <Feather name="user" size={64} color={NEON_GREEN} style={styles.nameIcon} />
              <ThemedText type="h1" style={styles.title}>
                {pages[currentPage].title}
              </ThemedText>
              <ThemedText type="body" style={styles.description}>
                {pages[currentPage].description}
              </ThemedText>
              
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={userName}
                onChangeText={setUserName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleNameSubmit}
              />
              
              <Pressable style={styles.nameButton} onPress={handleNameSubmit}>
                <LinearGradient
                  colors={[NEON_GREEN, NEON_CYAN]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nameButtonGradient}
                >
                  <ThemedText style={styles.nameButtonText}>
                    {userName.trim() ? 'Continue' : 'Skip'}
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : isAnatomyPage ? (
            <Animated.View
              key={currentPage}
              entering={FadeIn.duration(300)}
              style={styles.anatomyContainer}
            >
              <ThemedText type="h1" style={styles.title}>
                {pages[currentPage].title}
              </ThemedText>
              <ThemedText type="body" style={styles.description}>
                {pages[currentPage].description}
              </ThemedText>
              
              <View style={styles.anatomyButtons}>
                <Pressable
                  style={styles.anatomyButton}
                  onPress={() => handleAnatomySelect('female')}
                >
                  <LinearGradient
                    colors={[NEON_PINK, '#FF6699']}
                    style={styles.anatomyButtonGradient}
                  >
                    <Feather name="heart" size={32} color="#fff" />
                    <ThemedText style={styles.anatomyButtonText}>Female</ThemedText>
                  </LinearGradient>
                </Pressable>
                
                <Pressable
                  style={styles.anatomyButton}
                  onPress={() => handleAnatomySelect('male')}
                >
                  <LinearGradient
                    colors={[NEON_CYAN, '#00CCFF']}
                    style={styles.anatomyButtonGradient}
                  >
                    <Feather name="shield" size={32} color="#fff" />
                    <ThemedText style={styles.anatomyButtonText}>Male</ThemedText>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <>
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
            </>
          )}
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

          {!isAnatomyPage && !isNamePage ? (
            <NeonButton onPress={handleNext}>
              {isLastPage ? 'Get Started' : 'Continue'}
            </NeonButton>
          ) : null}
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
  anatomyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  anatomyButtons: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing['3xl'],
  },
  anatomyButton: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  anatomyButtonGradient: {
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    minWidth: 120,
  },
  anatomyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  nameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  nameIcon: {
    marginBottom: Spacing.xl,
  },
  nameInput: {
    width: '100%',
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing['2xl'],
    color: '#fff',
    fontSize: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.3)',
  },
  nameButton: {
    width: '100%',
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  nameButtonGradient: {
    height: Spacing.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
});
