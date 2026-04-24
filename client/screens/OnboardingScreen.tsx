import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Dimensions,
  Pressable,
  TextInput,
  ScrollView,
  Text,
  Switch,
} from 'react-native';
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
import Slider from '@react-native-community/slider';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, AnatomyType, defaultSettings } from '@/lib/storage';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { useAudio } from '@/contexts/AudioContext';
import { ALL_AMBIENT_TRACKS } from '@/lib/audioManager';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const { width } = Dimensions.get('window');

type PageEntry = {
  type?: string;
  title: string;
  description: string;
  image?: ReturnType<typeof require>;
};

const pages: PageEntry[] = [
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
    type: 'guide',
    image: require('../../assets/images/find-the-target.png'),
    title: 'Find the Target',
    description:
      "The pelvic floor is the hidden control system at the base of your body. Lift, don't clench \u2014 think elevator, not fist.",
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
    type: 'settings',
    title: 'Set Your Preferences',
    description:
      'Customize the experience to match how you like to train. You can always adjust these in Settings later.',
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
  const [restDuration, setRestDuration] = useState(defaultSettings.restDuration);
  const [blockRestDuration, setBlockRestDuration] = useState(defaultSettings.blockRestDuration);
  const insets = useSafeAreaInsets();
  const { cp, isDarkMode, toggleDarkMode } = useThemePreference();
  const { audioSettings, updateAudioSettings } = useAudio();

  const isLastPage = currentPage === pages.length - 1;
  const isAnatomyPage = pages[currentPage].type === 'anatomy';
  const isNamePage = pages[currentPage].type === 'name';
  const isSettingsPage = pages[currentPage].type === 'settings';
  const isGuidePage = pages[currentPage].type === 'guide';

  useEffect(() => {
    if (isSettingsPage) {
      storage.getSettings().then((s) => {
        setRestDuration(s.restDuration);
        setBlockRestDuration(s.blockRestDuration);
      });
    }
  }, [isSettingsPage]);

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

  const handleSelectTheme = async (wantDark: boolean) => {
    if (isDarkMode !== wantDark) {
      await toggleDarkMode();
    }
  };

  const handleRestDurationChange = async (value: number) => {
    setRestDuration(value);
    await storage.saveSettings({ restDuration: value });
  };

  const handleBlockRestDurationChange = async (value: number) => {
    setBlockRestDuration(value);
    await storage.saveSettings({ blockRestDuration: value });
  };

  const handleMusicToggle = async (enabled: boolean) => {
    if (enabled) {
      await updateAudioSettings({ selectedTracks: ALL_AMBIENT_TRACKS });
    } else {
      await updateAudioSettings({ selectedTracks: [] });
    }
  };

  const musicEnabled = audioSettings.selectedTracks.length > 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
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
              <Feather name="user" size={64} color={cp.neonGreen} style={styles.nameIcon} />
              <ThemedText type="h1" style={[styles.title, { color: cp.text }]}>
                {pages[currentPage].title}
              </ThemedText>
              <ThemedText type="body" style={[styles.description, { color: cp.textSecondary }]}>
                {pages[currentPage].description}
              </ThemedText>

              <TextInput
                style={[styles.nameInput, { backgroundColor: cp.cardBorder, color: cp.text, borderColor: `${cp.neonGreen}4D` }]}
                placeholder="Enter your name"
                placeholderTextColor={cp.textMuted}
                value={userName}
                onChangeText={setUserName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleNameSubmit}
              />

              <Pressable style={styles.nameButton} onPress={handleNameSubmit}>
                <LinearGradient
                  colors={[cp.neonGreen, cp.neonCyan]}
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
              <ThemedText type="h1" style={[styles.title, { color: cp.text }]}>
                {pages[currentPage].title}
              </ThemedText>
              <ThemedText type="body" style={[styles.description, { color: cp.textSecondary }]}>
                {pages[currentPage].description}
              </ThemedText>

              <View style={styles.anatomyButtons}>
                <Pressable
                  style={styles.anatomyButton}
                  onPress={() => handleAnatomySelect('female')}
                >
                  <LinearGradient
                    colors={[cp.neonPink, '#FF6699']}
                    style={styles.anatomyButtonGradient}
                  >
                    <Feather name="heart" size={32} color={cp.text} />
                    <ThemedText style={[styles.anatomyButtonText, { color: cp.text }]}>Female</ThemedText>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  style={styles.anatomyButton}
                  onPress={() => handleAnatomySelect('male')}
                >
                  <LinearGradient
                    colors={[cp.neonCyan, '#00CCFF']}
                    style={styles.anatomyButtonGradient}
                  >
                    <Feather name="shield" size={32} color={cp.text} />
                    <ThemedText style={[styles.anatomyButtonText, { color: cp.text }]}>Male</ThemedText>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          ) : isGuidePage ? (
            <Animated.View
              key={currentPage}
              entering={FadeIn.duration(300)}
              style={styles.guideContainer}
            >
              <ScrollView
                style={styles.guideScroll}
                contentContainerStyle={styles.guideScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={pages[currentPage].image!}
                  style={styles.guideImage}
                  resizeMode="contain"
                />
                <ThemedText type="h1" style={[styles.title, { color: cp.text }]}>
                  {pages[currentPage].title}
                </ThemedText>
                <ThemedText type="body" style={[styles.description, { color: cp.textSecondary }]}>
                  {pages[currentPage].description}
                </ThemedText>
              </ScrollView>
            </Animated.View>
          ) : isSettingsPage ? (
            <Animated.View
              key={currentPage}
              entering={FadeIn.duration(300)}
              style={styles.settingsContainer}
            >
              <ThemedText type="h1" style={[styles.title, { color: cp.text }]}>
                {pages[currentPage].title}
              </ThemedText>
              <ThemedText type="body" style={[styles.description, { color: cp.textSecondary }]}>
                {pages[currentPage].description}
              </ThemedText>

              <ScrollView
                style={styles.settingsScroll}
                contentContainerStyle={styles.settingsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.settingsCard, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
                  <View style={styles.settingsSectionHeader}>
                    <Feather name="sun" size={16} color={cp.neonCyan} />
                    <Text style={[styles.settingsSectionLabel, { color: cp.neonCyan }]}>THEME</Text>
                  </View>
                  <View style={styles.themeCards}>
                    <Pressable
                      style={[
                        styles.themeCard,
                        {
                          backgroundColor: isDarkMode ? `${cp.neonGreen}22` : cp.cardBorder,
                          borderColor: isDarkMode ? cp.neonGreen : cp.divider,
                        },
                      ]}
                      onPress={() => handleSelectTheme(true)}
                    >
                      <View style={[styles.themePreview, styles.themePreviewDark]}>
                        <View style={styles.themePreviewBar} />
                        <View style={[styles.themePreviewBar, { opacity: 0.6, width: '70%' }]} />
                      </View>
                      <Feather
                        name="moon"
                        size={18}
                        color={isDarkMode ? cp.neonGreen : cp.textMuted}
                      />
                      <Text style={[styles.themeCardLabel, { color: isDarkMode ? cp.neonGreen : cp.textMuted }]}>
                        Dark
                      </Text>
                      {isDarkMode ? (
                        <View style={[styles.themeCheckmark, { backgroundColor: cp.neonGreen }]}>
                          <Feather name="check" size={10} color="#000" />
                        </View>
                      ) : null}
                    </Pressable>

                    <Pressable
                      style={[
                        styles.themeCard,
                        {
                          backgroundColor: !isDarkMode ? `${cp.neonGreen}22` : cp.cardBorder,
                          borderColor: !isDarkMode ? cp.neonGreen : cp.divider,
                        },
                      ]}
                      onPress={() => handleSelectTheme(false)}
                    >
                      <View style={[styles.themePreview, styles.themePreviewLight]}>
                        <View style={[styles.themePreviewBar, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
                        <View style={[styles.themePreviewBar, { backgroundColor: 'rgba(0,0,0,0.12)', width: '70%' }]} />
                      </View>
                      <Feather
                        name="sun"
                        size={18}
                        color={!isDarkMode ? cp.neonGreen : cp.textMuted}
                      />
                      <Text style={[styles.themeCardLabel, { color: !isDarkMode ? cp.neonGreen : cp.textMuted }]}>
                        Light
                      </Text>
                      {!isDarkMode ? (
                        <View style={[styles.themeCheckmark, { backgroundColor: cp.neonGreen }]}>
                          <Feather name="check" size={10} color="#000" />
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.settingsCard, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
                  <View style={styles.settingsSectionHeader}>
                    <Feather name="clock" size={16} color={cp.neonCyan} />
                    <Text style={[styles.settingsSectionLabel, { color: cp.neonCyan }]}>WORKOUT TIMINGS</Text>
                  </View>

                  <View style={styles.sliderBlock}>
                    <View style={styles.sliderRow}>
                      <Text style={[styles.sliderLabel, { color: cp.text }]}>Rest between reps</Text>
                      <Text style={[styles.sliderValue, { color: cp.neonGreen }]}>{restDuration}s</Text>
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={2}
                      maximumValue={10}
                      step={1}
                      value={restDuration}
                      onValueChange={(value: number) => setRestDuration(value)}
                      onSlidingComplete={handleRestDurationChange}
                      minimumTrackTintColor={cp.neonGreen}
                      maximumTrackTintColor={cp.inputBg}
                      thumbTintColor={cp.neonGreen}
                    />
                    <Text style={[styles.sliderHint, { color: cp.textMuted }]}>2 – 10 seconds</Text>
                  </View>

                  <View style={[styles.sliderDivider, { backgroundColor: cp.divider }]} />

                  <View style={styles.sliderBlock}>
                    <View style={styles.sliderRow}>
                      <Text style={[styles.sliderLabel, { color: cp.text }]}>Rest between blocks</Text>
                      <Text style={[styles.sliderValue, { color: cp.neonCyan }]}>{blockRestDuration}s</Text>
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={10}
                      maximumValue={45}
                      step={5}
                      value={blockRestDuration}
                      onValueChange={(value: number) => setBlockRestDuration(value)}
                      onSlidingComplete={handleBlockRestDurationChange}
                      minimumTrackTintColor={cp.neonCyan}
                      maximumTrackTintColor={cp.inputBg}
                      thumbTintColor={cp.neonCyan}
                    />
                    <Text style={[styles.sliderHint, { color: cp.textMuted }]}>10 – 45 seconds</Text>
                  </View>
                </View>

                <View style={[styles.settingsCard, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
                  <View style={styles.settingsSectionHeader}>
                    <Feather name="music" size={16} color={cp.neonCyan} />
                    <Text style={[styles.settingsSectionLabel, { color: cp.neonCyan }]}>AMBIENT MUSIC</Text>
                  </View>
                  <View style={styles.musicToggleRow}>
                    <View style={styles.musicToggleText}>
                      <Text style={[styles.sliderLabel, { color: cp.text }]}>
                        Play music during workouts
                      </Text>
                      <Text style={[styles.sliderHint, { color: cp.textMuted, marginTop: 2 }]}>
                        {musicEnabled ? `All ${ALL_AMBIENT_TRACKS.length} tracks enabled` : 'Off'}
                      </Text>
                    </View>
                    <Switch
                      value={musicEnabled}
                      onValueChange={handleMusicToggle}
                      trackColor={{ false: cp.inputBg, true: `${cp.neonGreen}66` }}
                      thumbColor={musicEnabled ? cp.neonGreen : cp.textMuted}
                      ios_backgroundColor={cp.inputBg}
                    />
                  </View>
                  <Text style={[styles.musicHint, { color: cp.textMuted, borderTopColor: cp.divider }]}>
                    Manage individual tracks in Settings after setup.
                  </Text>
                </View>
              </ScrollView>
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
                <ThemedText type="h1" style={[styles.title, { color: cp.text }]}>
                  {pages[currentPage].title}
                </ThemedText>
                <ThemedText
                  type="body"
                  style={[styles.description, { color: cp.textSecondary }]}
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
                color={cp.neonGreen}
              />
            ))}
          </View>

          {!isAnatomyPage && !isNamePage ? (
            <NeonButton onPress={handleNext} cp={cp}>
              {isLastPage ? 'Get Started' : 'Continue'}
            </NeonButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function PageDot({ active, color }: { active: boolean; color: string }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 15, stiffness: 150 }),
    opacity: withSpring(active ? 1 : 0.4, { damping: 15, stiffness: 150 }),
  }));

  return (
    <View style={active ? [styles.dotGlow, { shadowColor: color }] : undefined}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color },
          animatedStyle,
        ]}
      />
    </View>
  );
}

function NeonButton({ onPress, children, cp }: { onPress: () => void; children: React.ReactNode; cp: { neonGreen: string; neonCyan: string } }) {
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
      <View style={[styles.buttonGlow, { shadowColor: cp.neonGreen }]}>
        <LinearGradient
          colors={[cp.neonGreen, cp.neonCyan, cp.neonGreen]}
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
  dotGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonWrapper: {
    width: '100%',
  },
  buttonGlow: {
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
    fontWeight: '600',
    fontSize: 16,
  },
  guideContainer: {
    flex: 1,
  },
  guideScroll: {
    flex: 1,
  },
  guideScrollContent: {
    alignItems: 'center',
    paddingBottom: Spacing.lg,
  },
  guideImage: {
    width: width * 0.9,
    height: width * 0.9 * (1024 / 576),
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
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
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing['2xl'],
    fontSize: 18,
    borderWidth: 1,
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
  settingsContainer: {
    flex: 1,
  },
  settingsScroll: {
    flex: 1,
    marginTop: Spacing.xl,
  },
  settingsScrollContent: {
    gap: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  settingsCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  settingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  settingsSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  themeCards: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  themeCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
    position: 'relative',
  },
  themePreview: {
    width: '100%',
    height: 48,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    justifyContent: 'center',
  },
  themePreviewDark: {
    backgroundColor: '#0a0a1a',
  },
  themePreviewLight: {
    backgroundColor: '#f0f2f7',
  },
  themePreviewBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,255,136,0.6)',
    width: '85%',
  },
  themeCardLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBlock: {
    gap: Spacing.xs,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 36,
  },
  sliderHint: {
    fontSize: 11,
  },
  sliderDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  musicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  musicToggleText: {
    flex: 1,
  },
  musicHint: {
    fontSize: 11,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
});
