import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ANIM_DURATION_ENTER, ANIM_DURATION_CONTENT_SLOW } from '@/constants/animation';

interface ForceUpdateScreenProps {
  iosStoreUrl: string;
  androidStoreUrl: string;
}

export default function ForceUpdateScreen({ iosStoreUrl, androidStoreUrl }: ForceUpdateScreenProps) {
  const insets = useSafeAreaInsets();
  const { cp } = useThemePreference();
  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value, flex: 1 }));

  useEffect(() => {
    opacity.value = withTiming(1, { duration: ANIM_DURATION_ENTER });
  }, []);

  const handleUpdate = async () => {
    const url = Platform.OS === 'ios' ? iosStoreUrl : androidStoreUrl;
    try {
      await Linking.openURL(url);
    } catch {
      // Nothing more we can do if the store URL fails to open
    }
  };

  return (
    <Animated.View style={fadeStyle}>
    <LinearGradient colors={cp.gradient} style={styles.container}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <Animated.View entering={FadeInUp.duration(ANIM_DURATION_CONTENT_SLOW)} style={styles.topSection}>
          <View style={[styles.iconCircle, { backgroundColor: cp.neonCyan + '22' }]}>
            <Text style={[styles.arrowIcon, { color: cp.neonCyan }]}>↑</Text>
          </View>
          <Text style={[styles.appName, { color: cp.textMuted }]}>PulseKegel</Text>
          <Text style={[styles.title, { color: cp.text }]}>
            Update Required
          </Text>
          <Text style={[styles.subtitle, { color: cp.textSecondary }]}>
            A new version of PulseKegel is available. Please update to continue your training.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT_SLOW).delay(150)} style={styles.bottomSection}>
          <Pressable
            testID="button-update-now"
            onPress={handleUpdate}
            style={({ pressed }) => [
              styles.updateButton,
              { backgroundColor: cp.neonCyan, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.updateButtonText}>Update Now</Text>
          </Pressable>
          <Text style={[styles.hint, { color: cp.textMuted }]}>
            {Platform.OS === 'ios' ? 'Opens the App Store' : 'Opens the Play Store'}
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  arrowIcon: {
    fontSize: 36,
    fontWeight: '700',
  },
  appName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  bottomSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  updateButton: {
    width: '100%',
    height: 56,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
  },
});
