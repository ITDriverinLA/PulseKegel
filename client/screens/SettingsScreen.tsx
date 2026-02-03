import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Pressable, Alert, Platform, ScrollView, Text, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { reloadAppAsync } from 'expo';
import * as WebBrowser from 'expo-web-browser';

import { ThemedText } from '@/components/ThemedText';
import { getApiUrl } from '@/lib/query-client';
import { Toggle } from '@/components/Toggle';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing, BorderRadius } from '@/constants/theme';
import { storage, UserSettings, defaultSettings } from '@/lib/storage';
import { hapticsManager } from '@/lib/hapticsManager';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';
const NEON_PURPLE = '#9D4EDD';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { refresh: refreshAccessibility, fontScale, colors } = useAccessibility();
  const { isSubscribed, isTrialActive, trialDaysRemaining, restorePurchases, hasAccess } = useSubscription();
  const [isRestoring, setIsRestoring] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    if (key === 'highContrastMode' || key === 'largeTextMode') {
      refreshAccessibility();
    }
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

  const handleDeleteAllData = () => {
    if (Platform.OS === 'web') {
      setShowDeleteModal(true);
    } else {
      Alert.alert(
        'Delete All My Data',
        'This will permanently delete all your personal information, settings, and workout history. The app will restart and you will need to set up again.\n\nThis action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Everything',
            style: 'destructive',
            onPress: async () => {
              await storage.clearAllData();
              await reloadAppAsync();
            },
          },
        ]
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
        Alert.alert('Success', 'Your purchases have been restored!', [{ text: 'OK' }]);
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.', [{ text: 'OK' }]);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    navigation.navigate('Paywall');
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
                onSlidingComplete={(value: number) => updateSetting('restDuration', value)}
                minimumTrackTintColor={NEON_GREEN}
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor={NEON_GREEN}
              />
              <Text style={styles.settingDescription}>
                Time between reps (2-10 seconds)
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Block Rest Duration</Text>
                <Text style={styles.sliderValue}>{settings.blockRestDuration}s</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={45}
                step={5}
                value={settings.blockRestDuration}
                onSlidingComplete={(value: number) => updateSetting('blockRestDuration', value)}
                minimumTrackTintColor={NEON_CYAN}
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor={NEON_CYAN}
              />
              <Text style={styles.settingDescription}>
                Breathing break between exercise blocks (10-45 seconds)
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
          <Text style={styles.sectionTitle}>PERSONALIZATION</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Your Name</Text>
              <TextInput
                style={styles.nameInput}
                value={settings.userName}
                onChangeText={(text) => updateSetting('userName', text)}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="words"
              />
            </View>
            <Text style={styles.settingDescription}>
              Used to personalize your weekly progress messages.
            </Text>
            
            <View style={styles.divider} />
            
            <SegmentedControl
              label="Anatomy Type"
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
              value={settings.anatomyType || 'female'}
              onChange={(value) => updateSetting('anatomyType', value as 'male' | 'female')}
              labelColor="#fff"
              trackColor="rgba(255,255,255,0.1)"
              indicatorColor="rgba(255,255,255,0.2)"
              textColor="#fff"
            />
            <Text style={styles.settingDescription}>
              Used to personalize weekly progress insights and health benefits.
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
          <View style={styles.card}>
            <View style={styles.subscriptionStatus}>
              <Feather 
                name={isSubscribed ? "check-circle" : (isTrialActive ? "clock" : "lock")} 
                size={24} 
                color={isSubscribed ? NEON_GREEN : (isTrialActive ? NEON_CYAN : NEON_PINK)} 
              />
              <View style={styles.subscriptionInfo}>
                <Text style={styles.subscriptionTitle}>
                  {isSubscribed ? 'Premium Active' : (isTrialActive ? `Free Trial - ${trialDaysRemaining} days left` : 'Trial Expired')}
                </Text>
                <Text style={styles.subscriptionDesc}>
                  {isSubscribed ? 'Thank you for supporting PulseKegel!' : (isTrialActive ? 'Enjoying full access during your trial' : 'Subscribe to continue your training')}
                </Text>
              </View>
            </View>
            
            {!isSubscribed && (
              <>
                <View style={styles.divider} />
                <Pressable onPress={handleManageSubscription} style={styles.subscriptionButton}>
                  <Feather name="unlock" size={20} color={NEON_GREEN} />
                  <Text style={[styles.subscriptionButtonText, { color: NEON_GREEN }]}>
                    {isTrialActive ? 'View Plans' : 'Subscribe Now'}
                  </Text>
                </Pressable>
              </>
            )}
            
            <View style={styles.divider} />
            
            <Pressable 
              onPress={handleRestorePurchases} 
              style={styles.subscriptionButton}
              disabled={isRestoring}
            >
              <Feather name="refresh-cw" size={20} color={NEON_CYAN} />
              <Text style={[styles.subscriptionButtonText, { color: NEON_CYAN }]}>
                {isRestoring ? 'Restoring...' : 'Restore Purchases'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(600)}>
          <Text style={styles.sectionTitle}>DATA</Text>
          <View style={styles.card}>
            <Pressable onPress={handleResetProgress} style={styles.dangerButton}>
              <Feather name="trash-2" size={20} color={NEON_PINK} />
              <Text style={styles.dangerText}>Reset All Progress</Text>
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable onPress={handleDeleteAllData} style={styles.dangerButton}>
              <Feather name="user-x" size={20} color={NEON_PINK} />
              <Text style={styles.dangerText}>Delete All My Data</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(600)}>
          <View style={styles.footer}>
            <Text style={styles.footerText}>PulseKegel v1.0.0</Text>
            <Text style={styles.footerText}>
              Not medical advice. Consult a healthcare provider for pelvic health concerns.
            </Text>
            <View style={styles.footerLinks}>
              <Pressable 
                onPress={() => {
                  const apiUrl = getApiUrl().replace(/\/$/, '');
                  WebBrowser.openBrowserAsync(`${apiUrl}/about`);
                }}
                style={styles.privacyLink}
              >
                <Text style={styles.privacyLinkText}>About</Text>
              </Pressable>
              <Text style={styles.footerDivider}>|</Text>
              <Pressable 
                onPress={() => {
                  const apiUrl = getApiUrl().replace(/\/$/, '');
                  WebBrowser.openBrowserAsync(`${apiUrl}/privacy`);
                }}
                style={styles.privacyLink}
              >
                <Text style={styles.privacyLinkText}>Privacy Policy</Text>
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
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#1a1a2e', '#16213e', '#0f0f23']}
              style={styles.modalGradient}
            >
              <View style={styles.modalIconContainer}>
                <Feather name="alert-triangle" size={48} color={NEON_PINK} />
              </View>
              
              <Text style={styles.modalTitle}>Delete All My Data</Text>
              
              <Text style={styles.modalMessage}>
                This will permanently delete all your personal information, settings, and workout history.
              </Text>
              <Text style={styles.modalMessage}>
                The app will restart and you will need to set up again.
              </Text>
              <Text style={[styles.modalMessage, { color: NEON_PINK, marginTop: Spacing.md }]}>
                This action cannot be undone.
              </Text>
              
              <View style={styles.modalButtons}>
                <Pressable
                  onPress={() => setShowDeleteModal(false)}
                  style={styles.modalCancelButton}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                
                <Pressable
                  onPress={confirmDeleteAllData}
                  style={styles.modalDeleteButton}
                >
                  <LinearGradient
                    colors={[NEON_PINK, '#cc2952']}
                    style={styles.modalDeleteGradient}
                  >
                    <Text style={styles.modalDeleteText}>Delete Everything</Text>
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
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  footerDivider: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  privacyLink: {
    paddingVertical: Spacing.sm,
  },
  privacyLinkText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#00FFFF',
    textDecorationLine: 'underline',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    marginRight: Spacing.md,
  },
  nameInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.3)',
  },
  modalGradient: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 51, 102, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: Spacing['2xl'],
    gap: Spacing.md,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalDeleteGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  subscriptionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  subscriptionInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  subscriptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subscriptionDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  subscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  subscriptionButtonText: {
    marginLeft: Spacing.md,
    fontSize: 16,
    fontWeight: '500',
  },
});
