import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  Modal,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Slider from "@react-native-community/slider";
import DateTimePicker from "@react-native-community/datetimepicker";
import { reloadAppAsync } from "expo";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  scheduleDailyReminder,
  cancelAllReminders,
} from "@/lib/notifications";

import { getApiUrl } from "@/lib/query-client";
import { Toggle } from "@/components/Toggle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_CONTENT,
  ANIM_DELAY_XS,
  ANIM_DELAY_SHORT,
  ANIM_DELAY_150,
  ANIM_DELAY_175,
  ANIM_DELAY_225,
  ANIM_DELAY_LONG,
  ANIM_DELAY_XL,
  ANIM_DELAY_2XL,
  ANIM_DELAY_3XL,
  ANIM_DELAY_4XL,
} from "@/constants/animation";
import { storage, UserSettings, defaultSettings } from "@/lib/storage";
import { hapticsManager } from "@/lib/hapticsManager";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { useAudio } from "@/contexts/AudioContext";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { refresh: refreshAccessibility } = useAccessibility();
  const { isSubscribed, isTrialActive, trialDaysRemaining, restorePurchases } =
    useSubscription();
  const { cp, isDarkMode, toggleDarkMode } = useThemePreference();
  const { audioSettings, updateAudioSettings, playSfx } = useAudio();
  const [isRestoring, setIsRestoring] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [permissionRevoked, setPermissionRevoked] = useState(false);
  const [difficultyPath, setDifficultyPath] = useState<
    "accelerated" | "standard" | "gentle" | null
  >(null);

  const loadSettings = useCallback(async () => {
    const [userSettings, calibState] = await Promise.all([
      storage.getSettings(),
      storage.getCalibrationState(),
    ]);
    setSettings(userSettings);
    setDifficultyPath(calibState.difficultyPath);
  }, []);

  const pathInfo = (() => {
    if (difficultyPath === "accelerated")
      return {
        label: "Accelerated Path",
        description:
          "Calibration showed Day 1 felt easy, so workouts ramp up faster.",
        color: cp.neonCyan,
      };
    if (difficultyPath === "gentle")
      return {
        label: "Gentle Path",
        description:
          "Calibration showed Day 1 was tough, so we ease in more gradually.",
        color: cp.neonPurple,
      };
    if (difficultyPath === "standard")
      return {
        label: "Standard Path",
        description:
          "Calibration showed Day 1 felt about right — you're on the standard plan.",
        color: cp.neonGreen,
      };
    return {
      label: "Not yet calibrated",
      description: "Complete Week 1, Day 1 to set your training path.",
      color: cp.textMuted,
    };
  })();

  const handleResetCalibration = () => {
    const doReset = async () => {
      await storage.clearCalibrationState();
      setDifficultyPath(null);
      await hapticsManager.triggerWarning();
    };
    if (Platform.OS === "web") {
      if (
        confirm(
          "Reset your training path? You'll be re-calibrated on your next Day 1.",
        )
      ) {
        doReset();
      }
    } else {
      Alert.alert(
        "Reset Training Path",
        "This clears your current path. You'll see the calibration intro again on your next Day 1 workout.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reset", style: "destructive", onPress: doReset },
        ],
      );
    }
  };

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const checkPermissionStatus = useCallback(async () => {
    const currentSettings = await storage.getSettings();
    if (currentSettings.reminderEnabled) {
      const status = await getNotificationPermissionStatus();
      setPermissionRevoked(status !== "granted");
    } else {
      setPermissionRevoked(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadSettings();
      checkPermissionStatus();
    });
    return unsubscribe;
  }, [navigation, loadSettings, checkPermissionStatus]);

  const handleReminderToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        if (Platform.OS !== "web") {
          Alert.alert(
            "Notifications Disabled",
            "Please enable notifications in your device Settings to receive daily reminders.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch {}
                },
              },
            ],
          );
        }
        return;
      }
      await updateSetting("reminderEnabled", true);
      await scheduleDailyReminder(settings.reminderTime);
      setPermissionRevoked(false);
    } else {
      await updateSetting("reminderEnabled", false);
      await cancelAllReminders();
    }
  };

  const handleTimeChange = async (_event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, "0");
      const mins = String(selectedDate.getMinutes()).padStart(2, "0");
      const timeStr = `${hours}:${mins}`;
      await updateSetting("reminderTime", timeStr);
      if (settings.reminderEnabled) {
        await scheduleDailyReminder(timeStr);
      }
    }
  };

  const getReminderTimeDate = (): Date => {
    const [h, m] = (settings.reminderTime || "08:00").split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const formatTime12h = (timeStr: string): string => {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await storage.saveSettings({ [key]: value });
    if (key === "highContrastMode" || key === "largeTextMode") {
      refreshAccessibility();
    }
  };

  const handleResetProgress = () => {
    if (Platform.OS === "web") {
      if (confirm("This will delete all your progress. Are you sure?")) {
        storage.clearAllData();
        loadSettings();
      }
    } else {
      Alert.alert(
        "Reset All Progress",
        "This will delete all your workout history and settings. This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reset",
            style: "destructive",
            onPress: async () => {
              await storage.clearAllData();
              await loadSettings();
              await hapticsManager.triggerWarning();
            },
          },
        ],
      );
    }
  };

  const handleDeleteAllData = () => {
    if (Platform.OS === "web") {
      setShowDeleteModal(true);
    } else {
      Alert.alert(
        "Delete All My Data",
        "This will permanently delete all your personal information, settings, and workout history. The app will restart and you will need to set up again.\n\nThis action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete Everything",
            style: "destructive",
            onPress: async () => {
              await storage.clearAllData();
              await reloadAppAsync();
            },
          },
        ],
      );
    }
  };

  const confirmDeleteAllData = async () => {
    setShowDeleteModal(false);
    await storage.clearAllData();
    await reloadAppAsync();
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert(
          "Subscription Restored",
          "Your subscription has been restored successfully.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert(
          "No Active Subscription Found",
          "We could not find an active subscription linked to your Apple ID.\n\nPlease check iOS Settings → [Your Name] → Subscriptions to confirm PulseKegel is listed as active. If your subscription lapsed, you can renew it there.",
          [
            {
              text: "Check Apple Subscriptions",
              onPress: async () => {
                try {
                  await Linking.openURL(
                    "https://apps.apple.com/account/subscriptions",
                  );
                } catch {}
              },
            },
            { text: "OK", style: "cancel" },
          ],
        );
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    navigation.navigate("Paywall");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
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
        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_XS,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            APPEARANCE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Toggle
              label="Dark Mode"
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_SHORT,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            HAPTIC FEEDBACK
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Toggle
              label="Enable Haptics"
              value={settings.hapticsEnabled}
              onValueChange={(value) => updateSetting("hapticsEnabled", value)}
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <SegmentedControl
              label="Haptic Intensity"
              options={[
                { value: "light", label: "Light" },
                { value: "medium", label: "Medium" },
                { value: "heavy", label: "Heavy" },
              ]}
              value={settings.hapticIntensity}
              onChange={(value) => updateSetting("hapticIntensity", value)}
              labelColor={cp.text}
              trackColor={cp.inputBg}
              indicatorColor={
                isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"
              }
              textColor={cp.text}
            />

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <SegmentedControl
              label="Rest Cue Style"
              options={[
                { value: "none", label: "None" },
                { value: "light", label: "Light" },
                { value: "normal", label: "Normal" },
              ]}
              value={settings.restCueStyle}
              onChange={(value) => updateSetting("restCueStyle", value)}
              labelColor={cp.text}
              trackColor={cp.inputBg}
              indicatorColor={
                isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"
              }
              textColor={cp.text}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_150,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            SOUND
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Toggle
              label="Sound Effects"
              value={audioSettings.sfxEnabled}
              onValueChange={(value) =>
                updateAudioSettings({ sfxEnabled: value })
              }
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />
            <Text
              style={[styles.settingDescription, { color: cp.textSecondary }]}
            >
              Play sounds during workout phase transitions and countdowns.
            </Text>

            {audioSettings.sfxEnabled ? (
              <>
                <View
                  style={[styles.divider, { backgroundColor: cp.divider }]}
                />
                <View style={styles.sliderContainer}>
                  <View style={styles.sliderHeader}>
                    <Text style={[styles.sliderLabel, { color: cp.text }]}>
                      SFX Volume
                    </Text>
                    <Text style={[styles.sliderValue, { color: cp.neonGreen }]}>
                      {Math.round(audioSettings.sfxVolume * 100)}%
                    </Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    step={0.05}
                    value={audioSettings.sfxVolume}
                    onSlidingComplete={(value: number) => {
                      updateAudioSettings({ sfxVolume: value });
                      playSfx("squeeze");
                    }}
                    minimumTrackTintColor={cp.neonGreen}
                    maximumTrackTintColor={cp.inputBg}
                    thumbTintColor={cp.neonGreen}
                  />
                </View>
              </>
            ) : null}

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <Pressable
              onPress={() => navigation.navigate("Music")}
              style={styles.musicNavRow}
              testID="manage-music-button"
            >
              <View style={styles.musicNavLeft}>
                <Feather name="music" size={18} color={cp.neonCyan} />
                <View style={styles.musicNavTextContainer}>
                  <Text style={[styles.settingLabel, { color: cp.text }]}>
                    Ambient Music
                  </Text>
                  <Text
                    style={[
                      styles.settingDescription,
                      { color: cp.textSecondary, marginBottom: 0 },
                    ]}
                  >
                    {audioSettings.selectedTracks.length === 0
                      ? "Off"
                      : `${audioSettings.selectedTracks.length} track${audioSettings.selectedTracks.length !== 1 ? "s" : ""}${audioSettings.shuffleEnabled ? ", Shuffle" : ""}`}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={cp.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_175,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            REMINDERS
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            {permissionRevoked ? (
              <View
                style={[
                  styles.permissionBanner,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(255, 107, 157, 0.15)"
                      : "rgba(220, 38, 38, 0.08)",
                  },
                ]}
              >
                <Feather
                  name="alert-circle"
                  size={16}
                  color={isDarkMode ? "#FF6B9D" : "#DC2626"}
                />
                <Text
                  style={[
                    styles.permissionBannerText,
                    { color: isDarkMode ? "#FF6B9D" : "#DC2626" },
                  ]}
                >
                  Notifications are disabled in your device Settings.
                </Text>
                {Platform.OS !== "web" ? (
                  <Pressable
                    onPress={async () => {
                      try {
                        await Linking.openSettings();
                      } catch {}
                    }}
                  >
                    <Text
                      style={[
                        styles.permissionBannerLink,
                        { color: cp.neonCyan },
                      ]}
                    >
                      Fix
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Toggle
              label="Daily Reminder"
              value={settings.reminderEnabled}
              onValueChange={handleReminderToggle}
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />
            <Text
              style={[styles.settingDescription, { color: cp.textSecondary }]}
            >
              {"We'll remind you if you haven't completed your session."}
            </Text>

            {settings.reminderEnabled ? (
              <>
                <View
                  style={[styles.divider, { backgroundColor: cp.divider }]}
                />
                <View style={styles.timePickerRow}>
                  <Text style={[styles.settingLabel, { color: cp.text }]}>
                    Reminder Time
                  </Text>
                  {Platform.OS === "ios" ? (
                    <DateTimePicker
                      value={getReminderTimeDate()}
                      mode="time"
                      display="compact"
                      onChange={handleTimeChange}
                      themeVariant={isDarkMode ? "dark" : "light"}
                      testID="reminder-time-picker"
                    />
                  ) : (
                    <>
                      <Pressable
                        onPress={() => setShowTimePicker(true)}
                        style={[
                          styles.timeButton,
                          { backgroundColor: cp.inputBg },
                        ]}
                        testID="reminder-time-button"
                      >
                        <Feather name="clock" size={16} color={cp.neonCyan} />
                        <Text
                          style={[styles.timeButtonText, { color: cp.text }]}
                        >
                          {formatTime12h(settings.reminderTime || "08:00")}
                        </Text>
                      </Pressable>
                      {showTimePicker ? (
                        <DateTimePicker
                          value={getReminderTimeDate()}
                          mode="time"
                          display="spinner"
                          onChange={handleTimeChange}
                          testID="reminder-time-picker"
                        />
                      ) : null}
                    </>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_225,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            ACCESSIBILITY
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Toggle
              label="High Contrast Mode"
              value={settings.highContrastMode}
              onValueChange={(value) =>
                updateSetting("highContrastMode", value)
              }
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <Toggle
              label="Large Text"
              value={settings.largeTextMode}
              onValueChange={(value) => updateSetting("largeTextMode", value)}
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_LONG,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            WORKOUT MODE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Toggle
              label="Recovery Mode"
              value={settings.recoveryMode}
              onValueChange={(value) => updateSetting("recoveryMode", value)}
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />
            <Text
              style={[styles.settingDescription, { color: cp.textSecondary }]}
            >
              Reduces intensity by 50% and adds a relaxation segment at the end
              of each workout.
            </Text>

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: cp.text }]}>
                  Rest Duration
                </Text>
                <Text style={[styles.sliderValue, { color: cp.neonGreen }]}>
                  {settings.restDuration}s
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={2}
                maximumValue={10}
                step={1}
                value={settings.restDuration}
                onSlidingComplete={(value: number) =>
                  updateSetting("restDuration", value)
                }
                minimumTrackTintColor={cp.neonGreen}
                maximumTrackTintColor={cp.inputBg}
                thumbTintColor={cp.neonGreen}
              />
              <Text
                style={[styles.settingDescription, { color: cp.textSecondary }]}
              >
                Time between reps (2-10 seconds)
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: cp.text }]}>
                  Block Rest Duration
                </Text>
                <Text style={[styles.sliderValue, { color: cp.neonCyan }]}>
                  {settings.blockRestDuration}s
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={45}
                step={5}
                value={settings.blockRestDuration}
                onSlidingComplete={(value: number) =>
                  updateSetting("blockRestDuration", value)
                }
                minimumTrackTintColor={cp.neonCyan}
                maximumTrackTintColor={cp.inputBg}
                thumbTintColor={cp.neonCyan}
              />
              <Text
                style={[styles.settingDescription, { color: cp.textSecondary }]}
              >
                Breathing break between exercise blocks (10-45 seconds)
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <Toggle
              label="Cooldown Enabled"
              value={settings.cooldownEnabled}
              onValueChange={(value) => updateSetting("cooldownEnabled", value)}
              activeColor={cp.neonGreen}
              labelColor={cp.text}
            />
            <Text
              style={[styles.settingDescription, { color: cp.textSecondary }]}
            >
              Skip the cooldown segment at the end of workouts when disabled.
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_XL,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            TRAINING PATH
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <View style={styles.pathRow}>
              <View
                style={[
                  styles.pathIconWrap,
                  {
                    backgroundColor: `${pathInfo.color}1A`,
                    borderColor: `${pathInfo.color}4D`,
                  },
                ]}
              >
                <Feather name="trending-up" size={18} color={pathInfo.color} />
              </View>
              <View style={styles.pathTextWrap}>
                <Text
                  style={[styles.settingLabel, { color: cp.text }]}
                  testID="text-training-path"
                >
                  {pathInfo.label}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: cp.textSecondary, marginTop: 2 },
                  ]}
                >
                  {pathInfo.description}
                </Text>
              </View>
            </View>

            {difficultyPath ? (
              <>
                <View
                  style={[styles.divider, { backgroundColor: cp.divider }]}
                />
                <Pressable
                  onPress={handleResetCalibration}
                  style={styles.subscriptionButton}
                  testID="button-reset-calibration"
                >
                  <Feather name="refresh-ccw" size={20} color={cp.neonCyan} />
                  <Text
                    style={[
                      styles.subscriptionButtonText,
                      { color: cp.neonCyan },
                    ]}
                  >
                    Reset Calibration
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_XL,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            PERSONALIZATION
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: cp.text }]}>
                Your Name
              </Text>
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: cp.inputBg,
                    color: cp.text,
                    borderColor: `${cp.neonGreen}4D`,
                  },
                ]}
                value={settings.userName}
                onChangeText={(text) => updateSetting("userName", text)}
                placeholder="Enter your name"
                placeholderTextColor={cp.textMuted}
                autoCapitalize="words"
              />
            </View>
            <Text
              style={[styles.settingDescription, { color: cp.textSecondary }]}
            >
              Used to personalize your weekly progress messages.
            </Text>

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <SegmentedControl
              label="Anatomy Type"
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
              ]}
              value={settings.anatomyType || "female"}
              onChange={(value) =>
                updateSetting("anatomyType", value as "male" | "female")
              }
              labelColor={cp.text}
              trackColor={cp.inputBg}
              indicatorColor={
                isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"
              }
              textColor={cp.text}
            />
            <Text
              style={[styles.settingDescription, { color: cp.textSecondary }]}
            >
              Used to personalize weekly progress insights and health benefits.
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_2XL,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            SUBSCRIPTION
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <View style={styles.subscriptionStatus}>
              <Feather
                name={
                  isSubscribed
                    ? "check-circle"
                    : isTrialActive
                      ? "clock"
                      : "lock"
                }
                size={24}
                color={
                  isSubscribed
                    ? cp.neonGreen
                    : isTrialActive
                      ? cp.neonCyan
                      : cp.neonPink
                }
              />
              <View style={styles.subscriptionInfo}>
                <Text style={[styles.subscriptionTitle, { color: cp.text }]}>
                  {isSubscribed
                    ? "Premium Active"
                    : isTrialActive
                      ? `7-Day Challenge – ${trialDaysRemaining} days left`
                      : "Challenge Ended"}
                </Text>
                <Text
                  style={[styles.subscriptionDesc, { color: cp.textSecondary }]}
                >
                  {isSubscribed
                    ? "Thank you for supporting PulseKegel!"
                    : isTrialActive
                      ? "Enjoying full access during your challenge"
                      : "Subscribe to continue your training"}
                </Text>
              </View>
            </View>

            {!isSubscribed && (
              <>
                <View
                  style={[styles.divider, { backgroundColor: cp.divider }]}
                />
                <Pressable
                  onPress={handleManageSubscription}
                  style={styles.subscriptionButton}
                >
                  <Feather name="unlock" size={20} color={cp.neonGreen} />
                  <Text
                    style={[
                      styles.subscriptionButtonText,
                      { color: cp.neonGreen },
                    ]}
                  >
                    {isTrialActive ? "View Plans" : "Subscribe Now"}
                  </Text>
                </Pressable>
              </>
            )}

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <Pressable
              onPress={handleRestorePurchases}
              style={styles.subscriptionButton}
              disabled={isRestoring}
            >
              <Feather name="refresh-cw" size={20} color={cp.neonCyan} />
              <Text
                style={[styles.subscriptionButtonText, { color: cp.neonCyan }]}
              >
                {isRestoring ? "Restoring..." : "Restore Purchases"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_3XL,
          )}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: cp.neonCyan,
                textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
              },
            ]}
          >
            DATA
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Pressable
              onPress={handleResetProgress}
              style={styles.dangerButton}
            >
              <Feather name="trash-2" size={20} color={cp.neonPink} />
              <Text style={[styles.dangerText, { color: cp.neonPink }]}>
                Reset All Progress
              </Text>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: cp.divider }]} />

            <Pressable
              onPress={handleDeleteAllData}
              style={styles.dangerButton}
            >
              <Feather name="user-x" size={20} color={cp.neonPink} />
              <Text style={[styles.dangerText, { color: cp.neonPink }]}>
                Delete All My Data
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_4XL,
          )}
        >
          <View style={styles.sectionTitleRow}>
            <Feather name="book-open" size={14} color={cp.neonCyan} />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: cp.neonCyan,
                  textShadowColor: isDarkMode ? cp.neonCyan : "transparent",
                },
              ]}
            >
              RESOURCES
            </Text>
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Pressable
              style={styles.settingsRow}
              onPress={() => navigation.navigate("TechniqueGuide")}
              testID="button-muscle-guide"
            >
              <Feather name="crosshair" size={20} color={cp.neonCyan} />
              <Text style={[styles.settingsRowText, { color: cp.text }]}>
                Muscle Targeting Guide
              </Text>
              <Feather name="chevron-right" size={18} color={cp.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_3XL,
          )}
        >
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: cp.textMuted }]}>
              PulseKegel v{Constants.expoConfig?.version ?? "—"}
            </Text>
            <Text style={[styles.footerText, { color: cp.textMuted }]}>
              Not medical advice. Consult a healthcare provider for pelvic
              health concerns.
            </Text>
            <View style={styles.footerLinks}>
              <Pressable
                onPress={() => {
                  const apiUrl = getApiUrl().replace(/\/$/, "");
                  WebBrowser.openBrowserAsync(`${apiUrl}/about`);
                }}
                style={styles.privacyLink}
              >
                <Text style={[styles.privacyLinkText, { color: cp.neonCyan }]}>
                  About
                </Text>
              </Pressable>
              <Text style={[styles.footerDivider, { color: cp.textMuted }]}>
                |
              </Text>
              <Pressable
                onPress={() => {
                  const apiUrl = getApiUrl().replace(/\/$/, "");
                  WebBrowser.openBrowserAsync(`${apiUrl}/privacy`);
                }}
                style={styles.privacyLink}
              >
                <Text style={[styles.privacyLinkText, { color: cp.neonCyan }]}>
                  Privacy Policy
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContainer, { borderColor: `${cp.neonPink}4D` }]}
          >
            <LinearGradient
              colors={
                isDarkMode
                  ? ["#1a1a2e", "#16213e", "#0f0f23"]
                  : ["#fff", "#f8f9fb", "#f0f2f7"]
              }
              style={styles.modalGradient}
            >
              <View
                style={[
                  styles.modalIconContainer,
                  { backgroundColor: `${cp.neonPink}26` },
                ]}
              >
                <Feather name="alert-triangle" size={48} color={cp.neonPink} />
              </View>

              <Text style={[styles.modalTitle, { color: cp.text }]}>
                Delete All My Data
              </Text>

              <Text
                style={[
                  styles.modalMessage,
                  {
                    color: isDarkMode
                      ? "rgba(255,255,255,0.8)"
                      : "rgba(0,0,0,0.7)",
                  },
                ]}
              >
                This will permanently delete all your personal information,
                settings, and workout history.
              </Text>
              <Text
                style={[
                  styles.modalMessage,
                  {
                    color: isDarkMode
                      ? "rgba(255,255,255,0.8)"
                      : "rgba(0,0,0,0.7)",
                  },
                ]}
              >
                The app will restart and you will need to set up again.
              </Text>
              <Text
                style={[
                  styles.modalMessage,
                  { color: cp.neonPink, marginTop: Spacing.md },
                ]}
              >
                This action cannot be undone.
              </Text>

              <View style={styles.modalButtons}>
                <Pressable
                  onPress={() => setShowDeleteModal(false)}
                  style={[
                    styles.modalCancelButton,
                    { backgroundColor: cp.inputBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalCancelText,
                      { color: cp.textSecondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={confirmDeleteAllData}
                  style={styles.modalDeleteButton}
                >
                  <LinearGradient
                    colors={[cp.neonPink, "#cc2952"]}
                    style={styles.modalDeleteGradient}
                  >
                    <Text style={styles.modalDeleteText}>
                      Delete Everything
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
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
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    marginTop: Spacing.lg,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.xs,
  },
  settingDescription: {
    marginTop: Spacing.sm,
    lineHeight: 20,
    fontSize: 12,
  },
  sliderContainer: {
    paddingVertical: Spacing.sm,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  sliderLabel: {
    fontSize: 16,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 14,
  },
  previewButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  musicNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  musicNavLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  musicNavTextContainer: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  settingsRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  dangerText: {
    marginLeft: Spacing.md,
    fontSize: 16,
  },
  footer: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  footerText: {
    textAlign: "center",
    marginBottom: Spacing.sm,
    fontSize: 12,
  },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  footerDivider: {
    fontSize: 14,
  },
  privacyLink: {
    paddingVertical: Spacing.sm,
  },
  privacyLinkText: {
    textAlign: "center",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  settingLabel: {
    fontSize: 16,
    marginRight: Spacing.md,
  },
  nameInput: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  modalGradient: {
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: Spacing["2xl"],
    gap: Spacing.md,
    width: "100%",
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalDeleteButton: {
    flex: 1.5,
    borderRadius: 12,
    overflow: "hidden",
  },
  modalDeleteGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDeleteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  subscriptionStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  subscriptionInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subscriptionDesc: {
    fontSize: 13,
  },
  subscriptionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  subscriptionButtonText: {
    marginLeft: Spacing.md,
    fontSize: 16,
    fontWeight: "500",
  },
  timePickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  timeButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  permissionBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  permissionBannerLink: {
    fontSize: 13,
    fontWeight: "700",
  },
  pathRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  pathIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pathTextWrap: {
    flex: 1,
  },
});
