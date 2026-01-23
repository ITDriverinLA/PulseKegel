import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, UserSettings, defaultSettings } from '@/lib/storage';
import { hapticsManager } from '@/lib/hapticsManager';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
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
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Animated.View entering={FadeInDown.duration(400).delay(100)}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          HAPTIC FEEDBACK
        </ThemedText>
        <Card elevation={1} style={styles.section}>
          <Toggle
            label="Enable Haptics"
            value={settings.hapticsEnabled}
            onValueChange={(value) => updateSetting('hapticsEnabled', value)}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <SegmentedControl
            label="Haptic Intensity"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'medium', label: 'Medium' },
              { value: 'heavy', label: 'Heavy' },
            ]}
            value={settings.hapticIntensity}
            onChange={(value) => updateSetting('hapticIntensity', value)}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <SegmentedControl
            label="Rest Cue Style"
            options={[
              { value: 'none', label: 'None' },
              { value: 'light', label: 'Light' },
              { value: 'normal', label: 'Normal' },
            ]}
            value={settings.restCueStyle}
            onChange={(value) => updateSetting('restCueStyle', value)}
          />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(200)}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          ACCESSIBILITY
        </ThemedText>
        <Card elevation={1} style={styles.section}>
          <Toggle
            label="High Contrast Mode"
            value={settings.highContrastMode}
            onValueChange={(value) => updateSetting('highContrastMode', value)}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Toggle
            label="Large Text"
            value={settings.largeTextMode}
            onValueChange={(value) => updateSetting('largeTextMode', value)}
          />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(300)}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          WORKOUT MODE
        </ThemedText>
        <Card elevation={1} style={styles.section}>
          <Toggle
            label="Recovery Mode"
            value={settings.recoveryMode}
            onValueChange={(value) => updateSetting('recoveryMode', value)}
          />
          <ThemedText
            type="small"
            style={[styles.settingDescription, { color: theme.textSecondary }]}
          >
            Reduces intensity by 50% and adds a relaxation segment at the end of
            each workout.
          </ThemedText>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(400)}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          DATA
        </ThemedText>
        <Card elevation={1} style={styles.section}>
          <Pressable onPress={handleResetProgress} style={styles.dangerButton}>
            <Feather name="trash-2" size={20} color="#E94A4A" />
            <ThemedText type="body" style={styles.dangerText}>
              Reset All Progress
            </ThemedText>
          </Pressable>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(500)}>
        <View style={styles.footer}>
          <ThemedText
            type="small"
            style={[styles.footerText, { color: theme.textSecondary }]}
          >
            PulseKegel v1.0.0
          </ThemedText>
          <ThemedText
            type="small"
            style={[styles.footerText, { color: theme.textSecondary }]}
          >
            Not medical advice. Consult a healthcare provider for pelvic health concerns.
          </ThemedText>
        </View>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    marginTop: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.xs,
  },
  settingDescription: {
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dangerText: {
    color: '#E94A4A',
    marginLeft: Spacing.md,
  },
  footer: {
    marginTop: Spacing['2xl'],
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
