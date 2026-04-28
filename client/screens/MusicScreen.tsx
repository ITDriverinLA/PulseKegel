import React, { useCallback } from "react";
import { StyleSheet, View, Pressable, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import Slider from "@react-native-community/slider";

import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_CONTENT,
  ANIM_DELAY_SHORT,
  ANIM_DELAY_MED,
  ANIM_DELAY_LONG,
} from "@/constants/animation";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { useAudio } from "@/contexts/AudioContext";
import {
  TrackKey,
  AMBIENT_TRACK_LABELS,
  ALL_AMBIENT_TRACKS,
} from "@/lib/audioManager";

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

  const toggleTrack = useCallback(
    (track: TrackKey) => {
      const current = audioSettings.selectedTracks || [];
      const isSelected = current.includes(track);
      let updated: TrackKey[];
      if (isSelected) {
        updated = current.filter((t) => t !== track);
      } else {
        updated = [...current, track];
      }
      updateAudioSettings({ selectedTracks: updated });
    },
    [audioSettings.selectedTracks, updateAudioSettings],
  );

  const isTrackSelected = useCallback(
    (track: TrackKey) => {
      return (audioSettings.selectedTracks || []).includes(track);
    },
    [audioSettings.selectedTracks],
  );

  const selectedCount = (audioSettings.selectedTracks || []).length;
  const allSelected = selectedCount === ALL_AMBIENT_TRACKS.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      updateAudioSettings({ selectedTracks: [] });
    } else {
      updateAudioSettings({ selectedTracks: [...ALL_AMBIENT_TRACKS] });
    }
  }, [allSelected, updateAudioSettings]);

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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_SHORT,
          )}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="music" size={18} color={cp.neonCyan} />
              <Text style={[styles.sectionTitle, { color: cp.text }]}>
                Tracks
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={toggleAll}
                hitSlop={8}
                testID="toggle-all-button"
              >
                <Text style={[styles.selectedBadge, { color: cp.neonCyan }]}>
                  {allSelected ? "Deselect All" : "Select All"}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.sectionDesc, { color: cp.textSecondary }]}>
              Check the tracks you want to play during workouts.
            </Text>

            {ALL_AMBIENT_TRACKS.map((track) => {
              const selected = isTrackSelected(track);
              return (
                <Pressable
                  key={track}
                  onPress={() => toggleTrack(track)}
                  style={[
                    styles.trackRow,
                    selected && {
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    },
                  ]}
                  testID={`track-${track}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: selected ? cp.neonCyan : cp.textMuted },
                      selected && { backgroundColor: cp.neonCyan },
                    ]}
                  >
                    {selected ? (
                      <Feather
                        name="check"
                        size={14}
                        color={isDarkMode ? "#000" : "#fff"}
                      />
                    ) : null}
                  </View>
                  <Feather
                    name="disc"
                    size={16}
                    color={cp.textMuted}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text
                    style={[
                      styles.trackLabel,
                      { color: selected ? cp.text : cp.textSecondary },
                    ]}
                  >
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
                      {
                        backgroundColor:
                          previewingTrack === track
                            ? cp.neonCyan
                            : isDarkMode
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.06)",
                      },
                    ]}
                    testID={`preview-${track}`}
                  >
                    <Feather
                      name={previewingTrack === track ? "square" : "play"}
                      size={14}
                      color={
                        previewingTrack === track
                          ? isDarkMode
                            ? "#000"
                            : "#fff"
                          : cp.textSecondary
                      }
                    />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_MED,
          )}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <Pressable
              onPress={() =>
                updateAudioSettings({
                  shuffleEnabled: !audioSettings.shuffleEnabled,
                })
              }
              style={styles.shuffleRow}
              testID="shuffle-toggle"
            >
              <Feather
                name="shuffle"
                size={18}
                color={
                  audioSettings.shuffleEnabled ? cp.neonCyan : cp.textMuted
                }
              />
              <View style={styles.shuffleTextContainer}>
                <Text style={[styles.shuffleLabel, { color: cp.text }]}>
                  Shuffle
                </Text>
                <Text style={[styles.shuffleDesc, { color: cp.textSecondary }]}>
                  {audioSettings.shuffleEnabled
                    ? "Tracks play in random order"
                    : "Tracks play in list order"}
                </Text>
              </View>
              <View
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: audioSettings.shuffleEnabled
                      ? cp.neonCyan
                      : isDarkMode
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(0,0,0,0.15)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    audioSettings.shuffleEnabled && styles.toggleThumbActive,
                    {
                      backgroundColor: audioSettings.shuffleEnabled
                        ? isDarkMode
                          ? "#000"
                          : "#fff"
                        : cp.textMuted,
                    },
                  ]}
                />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_LONG,
          )}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="volume-2" size={18} color={cp.neonCyan} />
              <Text style={[styles.sectionTitle, { color: cp.text }]}>
                Volume
              </Text>
            </View>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: cp.text }]}>
                  Ambient Volume
                </Text>
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
                onSlidingComplete={(value: number) =>
                  updateAudioSettings({ ambientVolume: value })
                }
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  selectedBadge: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  trackLabel: {
    fontSize: 14,
    flex: 1,
  },
  previewButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  shuffleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  shuffleTextContainer: {
    flex: 1,
  },
  shuffleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  shuffleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  sliderContainer: {
    marginTop: Spacing.xs,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
});
