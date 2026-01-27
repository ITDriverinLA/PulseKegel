import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Pressable, Alert, Platform, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';

import { ThemedText } from '@/components/ThemedText';
import { Toggle } from '@/components/Toggle';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, UserSettings, defaultSettings } from '@/lib/storage';
import { hapticsManager } from '@/lib/hapticsManager';

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';
const NEON_PURPLE = '#9D4EDD';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();

  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  const loadSettings = useCallback(async () => {
    const userSettings = await storage.getSettings();
    setSettings(userSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadSettings);
    return unsubscribe;
  }, [navigation, loadSettings]);

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await storage.saveSettings({ [key]: value });
  };

  const handleResetProgress = () => {
    if (Platform.OS === 'web') {
      if (confirm('This will delete all your progress. Are you sure?')) {
        storage.clearAllData();
        loadSettings();
      }
    } else {
      Alert.alert(
        'Reset All Progress',
        'This will delete all your workout history and settings. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: async () => {
              await storage.clearAllData();
              await loadSettings();
              await hapticsManager.triggerWarning();
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Text style={styles.sectionTitle}>HAPTIC FEEDBACK</Text>
          <View style={styles.card}>
            <Toggle
              label="Enable Haptics"
              value={settings.hapticsEnabled}
              onValueChange={(value) => updateSetting('hapticsEnabled', value)}
              activeColor={NEON_GREEN}
              labelColor="#fff"
            />

            <View style={styles.divider} />

            <SegmentedControl
              label="Haptic Intensity"
              options={[
                { value: 'light', label: 'Light' },
                { value: 'medium', label: 'Medium' },
                { value: 'heavy', label: 'Heavy' },
              ]}
              value={settings.hapticIntensity}
              onChange={(value) => updateSetting('hapticIntensity', value)}
              labelColor="#fff"
              trackColor="rgba(255,255,255,0.1)"
              indicatorColor="rgba(255,255,255,0.2)"
              textColor="#fff"
            />

            <View style={styles.divider} />

            <SegmentedControl
              label="Rest Cue Style"
              options={[
                { value: 'none', label: 'None' },
                { value: 'light', label: 'Light' },
                { value: 'normal', label: 'Normal' },
              ]}
              value={settings.restCueStyle}
              onChange={(value) => updateSetting('restCueStyle', value)}
              labelColor="#fff"
              trackColor="rgba(255,255,255,0.1)"
              indicatorColor="rgba(255,255,255,0.2)"
              textColor="#fff"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={styles.sectionTitle}>ACCESSIBILITY</Text>
          <View style={styles.card}>
            <Toggle
              label="High Contrast Mode"
              value={settings.highContrastMode}
              onValueChange={(value) => updateSetting('highContrastMode', value)}
              activeColor={NEON_GREEN}
              labelColor="#fff"
            />

            <View style={styles.divider} />

            <Toggle
              label="Large Text"
              value={settings.largeTextMode}
              onValueChange={(value) => updateSetting('largeTextMode', value)}
              activeColor={NEON_GREEN}
              labelColor="#fff"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Text style={styles.sectionTitle}>WORKOUT MODE</Text>
          <View style={styles.card}>
            <Toggle
              label="Recovery Mode"
              value={settings.recoveryMode}
              onValueChange={(value) => updateSetting('recoveryMode', value)}
              activeColor={NEON_GREEN}
              labelColor="#fff"
            />
            <Text style={styles.settingDescription}>
              Reduces intensity by 50% and adds a relaxation segment at the end of
              each workout.
            </Text>

            <View style={styles.divider} />

            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Rest Duration</Text>
                <Text style={styles.sliderValue}>{settings.restDuration}s</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={2}
                maximumValue={10}
                step={1}
                value={settings.restDuration}
                onSlidingComplete={(value) => updateSetting('restDuration', value)}
                minimumTrackTintColor={NEON_GREEN}
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor={NEON_GREEN}
              />
              <Text style={styles.settingDescription}>
                Time between reps (2-10 seconds)
              </Text>
            </View>

            <View style={styles.divider} />

            <Toggle
              label="Cooldown Enabled"
              value={settings.cooldownEnabled}
              onValueChange={(value) => updateSetting('cooldownEnabled', value)}
              activeColor={NEON_GREEN}
              labelColor="#fff"
            />
            <Text style={styles.settingDescription}>
              Skip the cooldown segment at the end of workouts when disabled.
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Text style={styles.sectionTitle}>DATA</Text>
          <View style={styles.card}>
            <Pressable onPress={handleResetProgress} style={styles.dangerButton}>
              <Feather name="trash-2" size={20} color={NEON_PINK} />
              <Text style={styles.dangerText}>Reset All Progress</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <View style={styles.footer}>
            <Text style={styles.footerText}>PulseKegel v1.0.0</Text>
            <Text style={styles.footerText}>
              Not medical advice. Consult a healthcare provider for pelvic health concerns.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    marginTop: Spacing.lg,
    color: NEON_CYAN,
    textShadowColor: NEON_CYAN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  settingDescription: {
    marginTop: Spacing.sm,
    lineHeight: 20,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  sliderContainer: {
    paddingVertical: Spacing.sm,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sliderLabel: {
    fontSize: 16,
    color: '#fff',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: NEON_GREEN,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dangerText: {
    color: NEON_PINK,
    marginLeft: Spacing.md,
    fontSize: 16,
  },
  footer: {
    marginTop: Spacing['2xl'],
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
});
