import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';

import { Spacing, BorderRadius } from '@/constants/theme';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { useAudio } from '@/contexts/AudioContext';
import {
  AmbientTrack,
  AMBIENT_TRACK_LABELS,
  ALL_AMBIENT_TRACKS,
  ShuffleMode,
} from '@/lib/audioManager';

const SHUFFLE_OPTIONS: { value: ShuffleMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'Play the selected track on repeat' },
  { value: 'all', label: 'All Tracks', description: 'Shuffle through every track' },
  { value: 'selected', label: 'Selected Only', description: 'Shuffle through your chosen tracks' },
];

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { cp, isDarkMode } = useThemePreference();
  const {
    audioSettings,
    updateAudioSettings,
    previewTrack,
    stopPreview,
    previewingTrack,
  } = useAudio();

  const handleTrackSelect = useCallback((track: AmbientTrack) => {
    stopPreview();
    updateAudioSettings({ ambientTrack: track });
  }, [stopPreview, updateAudioSettings]);

  const handleShuffleModeChange = useCallback((mode: ShuffleMode) => {
    updateAudioSettings({ shuffleMode: mode });
  }, [updateAudioSettings]);

  const toggleShuffleTrack = useCallback((track: Exclude<AmbientTrack, 'none'>) => {
    const current = audioSettings.shuffleEnabledTracks || [...ALL_AMBIENT_TRACKS];
    const isEnabled = current.includes(track);
    let updated: Exclude<AmbientTrack, 'none'>[];
    if (isEnabled) {
      updated = current.filter(t => t !== track);
      if (updated.length === 0) return;
    } else {
      updated = [...current, track];
    }
    updateAudioSettings({ shuffleEnabledTracks: updated });
  }, [audioSettings.shuffleEnabledTracks, updateAudioSettings]);

  const isTrackInShuffle = useCallback((track: Exclude<AmbientTrack, 'none'>) => {
    const enabled = audioSettings.shuffleEnabledTracks || [...ALL_AMBIENT_TRACKS];
    return enabled.includes(track);
  }, [audioSettings.shuffleEnabledTracks]);

  return (
    <View style={[styles.container, { backgroundColor: cp.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => {
            stopPreview();
            navigation.goBack();
          }}
          hitSlop={12}
          style={styles.backButton}
          testID="music-back-button"
        >
          <Feather name="arrow-left" size={24} color={cp.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: cp.text }]}>Music</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={[styles.section, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <Feather name="music" size={18} color={cp.neonCyan} />
              <Text style={[styles.sectionTitle, { color: cp.text }]}>Now Playing</Text>
            </View>
            <Text style={[styles.sectionDesc, { color: cp.textSecondary }]}>
              Choose a track to play during workouts.
            </Text>

            <Pressable
              onPress={() => handleTrackSelect('none')}
              style={[
                styles.trackRow,
                audioSettings.ambientTrack === 'none' && { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
              ]}
              testID="track-none"
            >
              <View style={[
                styles.radioCircle,
                { borderColor: audioSettings.ambientTrack === 'none' ? cp.neonCyan : cp.textMuted },
              ]}>
                {audioSettings.ambientTrack === 'none' ? (
                  <View style={[styles.radioFill, { backgroundColor: cp.neonCyan }]} />
                ) : null}
              </View>
              <Feather name="volume-x" size={16} color={cp.textMuted} style={{ marginRight: Spacing.sm }} />
              <Text style={[styles.trackLabel, { color: audioSettings.ambientTrack === 'none' ? cp.text : cp.textSecondary }]}>
                No Music
              </Text>
            </Pressable>

            {ALL_AMBIENT_TRACKS.map((track) => (
              <Pressable
                key={track}
                onPress={() => handleTrackSelect(track)}
                style={[
                  styles.trackRow,
                  audioSettings.ambientTrack === track && { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                ]}
                testID={`track-${track}`}
              >
                <View style={[
                  styles.radioCircle,
                  { borderColor: audioSettings.ambientTrack === track ? cp.neonCyan : cp.textMuted },
                ]}>
                  {audioSettings.ambientTrack === track ? (
                    <View style={[styles.radioFill, { backgroundColor: cp.neonCyan }]} />
                  ) : null}
                </View>
                <Feather name="disc" size={16} color={cp.textMuted} style={{ marginRight: Spacing.sm }} />
                <Text style={[styles.trackLabel, { color: audioSettings.ambientTrack === track ? cp.text : cp.textSecondary }]}>
                  {AMBIENT_TRACK_LABELS[track]}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    previewTrack(track);
                  }}
                  hitSlop={8}
                  style={[
                    styles.previewButton,
                    { backgroundColor: previewingTrack === track ? cp.neonCyan : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') },
                  ]}
                  testID={`preview-${track}`}
                >
                  <Feather
                    name={previewingTrack === track ? 'square' : 'play'}
                    size={14}
                    color={previewingTrack === track ? (isDarkMode ? '#000' : '#fff') : cp.textSecondary}
                  />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <View style={[styles.section, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <Feather name="shuffle" size={18} color={cp.neonCyan} />
              <Text style={[styles.sectionTitle, { color: cp.text }]}>Shuffle</Text>
            </View>
            <Text style={[styles.sectionDesc, { color: cp.textSecondary }]}>
              Automatically switch tracks during your workout.
            </Text>

            {SHUFFLE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => handleShuffleModeChange(option.value)}
                style={[
                  styles.shuffleRow,
                  audioSettings.shuffleMode === option.value && { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                ]}
                testID={`shuffle-${option.value}`}
              >
                <View style={[
                  styles.radioCircle,
                  { borderColor: audioSettings.shuffleMode === option.value ? cp.neonCyan : cp.textMuted },
                ]}>
                  {audioSettings.shuffleMode === option.value ? (
                    <View style={[styles.radioFill, { backgroundColor: cp.neonCyan }]} />
                  ) : null}
                </View>
                <View style={styles.shuffleTextContainer}>
                  <Text style={[styles.shuffleLabel, { color: audioSettings.shuffleMode === option.value ? cp.text : cp.textSecondary }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.shuffleDesc, { color: cp.textMuted }]}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            ))}

            {audioSettings.shuffleMode === 'selected' ? (
              <View style={styles.selectedTracksContainer}>
                <Text style={[styles.selectedTracksTitle, { color: cp.text }]}>
                  Include in Shuffle
                </Text>
                {ALL_AMBIENT_TRACKS.map((track) => {
                  const enabled = isTrackInShuffle(track);
                  return (
                    <Pressable
                      key={track}
                      onPress={() => toggleShuffleTrack(track)}
                      style={styles.checkboxRow}
                      testID={`shuffle-check-${track}`}
                    >
                      <View style={[
                        styles.checkbox,
                        { borderColor: enabled ? cp.neonCyan : cp.textMuted },
                        enabled && { backgroundColor: cp.neonCyan },
                      ]}>
                        {enabled ? (
                          <Feather name="check" size={14} color={isDarkMode ? '#000' : '#fff'} />
                        ) : null}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: enabled ? cp.text : cp.textSecondary }]}>
                        {AMBIENT_TRACK_LABELS[track]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View style={[styles.section, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <Feather name="volume-2" size={18} color={cp.neonCyan} />
              <Text style={[styles.sectionTitle, { color: cp.text }]}>Volume</Text>
            </View>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: cp.text }]}>Ambient Volume</Text>
                <Text style={[styles.sliderValue, { color: cp.neonCyan }]}>
                  {Math.round(audioSettings.ambientVolume * 100)}%
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={audioSettings.ambientVolume}
                onSlidingComplete={(value: number) => updateAudioSettings({ ambientVolume: value })}
                minimumTrackTintColor={cp.neonCyan}
                maximumTrackTintColor={cp.inputBg}
                thumbTintColor={cp.neonCyan}
                testID="volume-slider"
              />
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trackLabel: {
    fontSize: 14,
    flex: 1,
  },
  previewButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  shuffleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  shuffleTextContainer: {
    flex: 1,
  },
  shuffleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  shuffleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  selectedTracksContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  selectedTracksTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  sliderContainer: {
    marginTop: Spacing.xs,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 16,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
