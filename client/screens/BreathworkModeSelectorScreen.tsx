import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BREATHWORK_MODES, BreathworkMode, BREATHWORK_COLORS } from '@/constants/breathworkModes';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MODE_ICONS: Record<BreathworkMode, keyof typeof Feather.glyphMap> = {
  calm: 'moon',
  energize: 'zap',
  pelvic_floor: 'heart',
};

const MODE_GRADIENTS: Record<BreathworkMode, [string, string]> = {
  calm: ['#1a2e42', '#0D1B2A'],
  energize: ['#2a1a42', '#1a0D2A'],
  pelvic_floor: ['#1a3a2e', '#0D2A1B'],
};

export default function BreathworkModeSelectorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  const handleSelectMode = (mode: BreathworkMode) => {
    navigation.navigate('BreathworkSession', { mode });
  };

  return (
    <View style={[styles.container, { backgroundColor: BREATHWORK_COLORS.bg_session }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} testID="breathwork-back-button">
          <Feather name="arrow-left" size={24} color={BREATHWORK_COLORS.phase_label} />
        </Pressable>
        <Text style={styles.title}>Breathwork</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Choose a 5-minute guided breathing session for your rest day.
        </Text>

        {BREATHWORK_MODES.map((mode, index) => (
          <Animated.View key={mode.id} entering={FadeInDown.duration(400).delay(index * 100)}>
            <Pressable
              onPress={() => handleSelectMode(mode.id)}
              style={styles.modeCard}
              testID={`mode-${mode.id}`}
            >
              <LinearGradient
                colors={MODE_GRADIENTS[mode.id]}
                style={styles.modeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.modeIconContainer}>
                  <Feather name={MODE_ICONS[mode.id]} size={32} color={BREATHWORK_COLORS.circle_inhale} />
                </View>
                <View style={styles.modeInfo}>
                  <Text style={styles.modeName}>{mode.name}</Text>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                  <Text style={styles.modeDescription}>{mode.description}</Text>
                </View>
                <View style={styles.modeDuration}>
                  <Text style={styles.durationText}>5 min</Text>
                  <Feather name="chevron-right" size={20} color={BREATHWORK_COLORS.timer_text} />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: BREATHWORK_COLORS.phase_label,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  subtitle: {
    fontSize: 15,
    color: BREATHWORK_COLORS.timer_text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  modeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 197, 0.2)',
  },
  modeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  modeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 180, 197, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    fontSize: 18,
    fontWeight: '700',
    color: BREATHWORK_COLORS.phase_label,
    marginBottom: 2,
  },
  modeSubtitle: {
    fontSize: 13,
    color: BREATHWORK_COLORS.circle_inhale,
    fontWeight: '600',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 13,
    color: BREATHWORK_COLORS.timer_text,
    lineHeight: 18,
  },
  modeDuration: {
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: BREATHWORK_COLORS.timer_text,
  },
});
