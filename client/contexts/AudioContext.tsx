import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  ReactNode,
} from "react";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { storage } from "@/lib/storage";
import {
  SoundEffect,
  AmbientTrack,
  TrackKey,
  AudioSettings,
  defaultAudioSettings,
  SOUND_SOURCES,
  AMBIENT_SOURCES,
} from "@/lib/audioManager";

interface AudioContextType {
  audioSettings: AudioSettings;
  updateAudioSettings: (updates: Partial<AudioSettings>) => Promise<void>;
  playSfx: (effect: SoundEffect) => void;
  startAmbient: () => void;
  stopAmbient: () => void;
  fadeOutAmbient: () => void;
  previewTrack: (track: TrackKey) => void;
  stopPreview: () => void;
  previewingTrack: AmbientTrack;
}

const AudioContext = createContext<AudioContextType>({
  audioSettings: defaultAudioSettings,
  updateAudioSettings: async () => {},
  playSfx: () => {},
  startAmbient: () => {},
  stopAmbient: () => {},
  fadeOutAmbient: () => {},
  previewTrack: () => {},
  stopPreview: () => {},
  previewingTrack: "none",
});

export function AudioProvider({ children }: { children: ReactNode }) {
  const [audioSettings, setAudioSettings] =
    useState<AudioSettings>(defaultAudioSettings);
  const [currentAmbientTrack, setCurrentAmbientTrack] =
    useState<AmbientTrack>("none");
  const [previewingTrack, setPreviewingTrack] = useState<AmbientTrack>("none");
  const isWorkoutActiveRef = useRef(false);
  const audioSettingsRef = useRef<AudioSettings>(defaultAudioSettings);
  const currentTrackIndexRef = useRef(0);
  const lastPlayedTrackRef = useRef<AmbientTrack>("none");
  const audioSettingsLoadedRef = useRef(false);
  const pendingAmbientStartRef = useRef(false);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackHasPlayedRef = useRef(false);

  useEffect(() => {
    audioSettingsRef.current = audioSettings;
  }, [audioSettings]);

  const squeezePlayer = useAudioPlayer(SOUND_SOURCES.squeeze);
  const restPlayer = useAudioPlayer(SOUND_SOURCES.rest);
  const breathePlayer = useAudioPlayer(SOUND_SOURCES.breathe);
  const countdownPlayer = useAudioPlayer(SOUND_SOURCES.countdown);
  const completePlayer = useAudioPlayer(SOUND_SOURCES.complete);
  const badgePlayer = useAudioPlayer(SOUND_SOURCES.badge);
  const ageWeapon1Player = useAudioPlayer(AMBIENT_SOURCES.age_weapon_1);
  const ageWeapon2Player = useAudioPlayer(AMBIENT_SOURCES.age_weapon_2);
  const trainingBeatsPlayer = useAudioPlayer(AMBIENT_SOURCES.training_beats);
  const trainingKegelPlayer = useAudioPlayer(AMBIENT_SOURCES.training_kegel);
  const quietPower1Player = useAudioPlayer(AMBIENT_SOURCES.quiet_power_1);
  const quietPower2Player = useAudioPlayer(AMBIENT_SOURCES.quiet_power_2);
  const quietPowerF1Player = useAudioPlayer(AMBIENT_SOURCES.quiet_power_f1);
  const quietPowerF2Player = useAudioPlayer(AMBIENT_SOURCES.quiet_power_f2);
  const surrenderPlayer = useAudioPlayer(AMBIENT_SOURCES.surrender);
  const onMyKneesPlayer = useAudioPlayer(AMBIENT_SOURCES.on_my_knees);
  const takeMePlayer = useAudioPlayer(AMBIENT_SOURCES.take_me);
  const velvetTidesPlayer = useAudioPlayer(AMBIENT_SOURCES.velvet_tides);
  const riversOfSurrenderPlayer = useAudioPlayer(
    AMBIENT_SOURCES.rivers_of_surrender,
  );
  const architectOfSurrenderPlayer = useAudioPlayer(
    AMBIENT_SOURCES.architect_of_surrender,
  );

  const sfxPlayers = useMemo<Record<SoundEffect, typeof squeezePlayer>>(
    () => ({
      squeeze: squeezePlayer,
      rest: restPlayer,
      breathe: breathePlayer,
      countdown: countdownPlayer,
      complete: completePlayer,
      badge: badgePlayer,
    }),
    [
      squeezePlayer,
      restPlayer,
      breathePlayer,
      countdownPlayer,
      completePlayer,
      badgePlayer,
    ],
  );

  const ambientPlayers = useMemo<Record<TrackKey, typeof ageWeapon1Player>>(
    () => ({
      age_weapon_1: ageWeapon1Player,
      age_weapon_2: ageWeapon2Player,
      training_beats: trainingBeatsPlayer,
      training_kegel: trainingKegelPlayer,
      quiet_power_1: quietPower1Player,
      quiet_power_2: quietPower2Player,
      quiet_power_f1: quietPowerF1Player,
      quiet_power_f2: quietPowerF2Player,
      surrender: surrenderPlayer,
      on_my_knees: onMyKneesPlayer,
      take_me: takeMePlayer,
      velvet_tides: velvetTidesPlayer,
      rivers_of_surrender: riversOfSurrenderPlayer,
      architect_of_surrender: architectOfSurrenderPlayer,
    }),
    [
      ageWeapon1Player,
      ageWeapon2Player,
      trainingBeatsPlayer,
      trainingKegelPlayer,
      quietPower1Player,
      quietPower2Player,
      quietPowerF1Player,
      quietPowerF2Player,
      surrenderPlayer,
      onMyKneesPlayer,
      takeMePlayer,
      velvetTidesPlayer,
      riversOfSurrenderPlayer,
      architectOfSurrenderPlayer,
    ],
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
        });
      } catch {}
      const settings = await storage.getAudioSettings();
      const merged = { ...defaultAudioSettings, ...settings } as AudioSettings;
      if (!merged.selectedTracks) {
        merged.selectedTracks = [];
      }
      audioSettingsRef.current = merged;
      audioSettingsLoadedRef.current = true;
      setAudioSettings(merged);
      if (pendingAmbientStartRef.current && isWorkoutActiveRef.current) {
        pendingAmbientStartRef.current = false;
        const tracks = merged.selectedTracks;
        if (tracks.length > 0) {
          const singleTrack = tracks.length === 1 && !merged.shuffleEnabled;
          if (merged.shuffleEnabled) {
            const track = tracks[Math.floor(Math.random() * tracks.length)];
            const player = ambientPlayers[track];
            if (player) {
              try {
                player.loop = false;
                player.volume = merged.ambientVolume;
                player.seekTo(0);
                player.play();
                setCurrentAmbientTrack(track);
                lastPlayedTrackRef.current = track;
              } catch {}
            }
          } else {
            currentTrackIndexRef.current = 1;
            const track = tracks[0];
            const player = ambientPlayers[track];
            if (player) {
              try {
                player.loop = singleTrack;
                player.volume = merged.ambientVolume;
                player.seekTo(0);
                player.play();
                setCurrentAmbientTrack(track);
                lastPlayedTrackRef.current = track;
              } catch {}
            }
          }
        }
      }
    };
    loadSettings();
  }, [ambientPlayers]);

  useEffect(() => {
    for (const player of Object.values(sfxPlayers)) {
      if (player) {
        player.volume = audioSettings.sfxVolume;
      }
    }
  }, [audioSettings.sfxVolume, sfxPlayers]);

  useEffect(() => {
    for (const player of Object.values(ambientPlayers)) {
      if (player) {
        player.volume = audioSettings.ambientVolume;
      }
    }
  }, [audioSettings.ambientVolume, ambientPlayers]);

  const stopAllAmbient = useCallback(() => {
    trackHasPlayedRef.current = false;
    for (const player of Object.values(ambientPlayers)) {
      if (player) {
        try {
          player.pause();
          player.seekTo(0);
        } catch {}
      }
    }
  }, [ambientPlayers]);

  const playTrackByKey = useCallback(
    (track: TrackKey, loop: boolean) => {
      const player = ambientPlayers[track];
      if (player) {
        try {
          player.loop = loop;
          player.volume = audioSettingsRef.current.ambientVolume;
          player.seekTo(0);
          player.play();
          setCurrentAmbientTrack(track);
          lastPlayedTrackRef.current = track;
          trackHasPlayedRef.current = true;
        } catch {}
      }
    },
    [ambientPlayers],
  );

  const pickNextTrack = useCallback((): TrackKey | null => {
    const settings = audioSettingsRef.current;
    const tracks = settings.selectedTracks;
    if (tracks.length === 0) return null;

    if (settings.shuffleEnabled) {
      if (tracks.length === 1) return tracks[0];
      const filtered = tracks.filter((t) => t !== lastPlayedTrackRef.current);
      const candidates = filtered.length > 0 ? filtered : tracks;
      return candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      const idx = currentTrackIndexRef.current % tracks.length;
      currentTrackIndexRef.current = idx + 1;
      return tracks[idx];
    }
  }, []);

  useEffect(() => {
    if (!isWorkoutActiveRef.current) return;
    const settings = audioSettingsRef.current;
    if (settings.selectedTracks.length <= 1 && !settings.shuffleEnabled) return;
    if (settings.selectedTracks.length === 0) return;

    const checkInterval = setInterval(() => {
      if (!isWorkoutActiveRef.current) return;
      const current = lastPlayedTrackRef.current;
      if (current === "none") return;
      const player = ambientPlayers[current as TrackKey];
      if (player && !player.playing && trackHasPlayedRef.current) {
        const next = pickNextTrack();
        if (next) {
          stopAllAmbient();
          playTrackByKey(
            next,
            audioSettingsRef.current.selectedTracks.length === 1,
          );
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [
    audioSettings.selectedTracks,
    audioSettings.shuffleEnabled,
    currentAmbientTrack,
    ambientPlayers,
    pickNextTrack,
    playTrackByKey,
    stopAllAmbient,
  ]);

  const updateAudioSettings = useCallback(
    async (updates: Partial<AudioSettings>) => {
      const newSettings = { ...audioSettings, ...updates };
      setAudioSettings(newSettings);
      await storage.saveAudioSettings(newSettings);
    },
    [audioSettings],
  );

  const playSfx = useCallback(
    (effect: SoundEffect) => {
      if (!audioSettings.sfxEnabled) return;
      const player = sfxPlayers[effect];
      if (player) {
        try {
          player.seekTo(0);
          player.volume = audioSettings.sfxVolume;
          player.play();
        } catch {}
      }
    },
    [audioSettings.sfxEnabled, audioSettings.sfxVolume, sfxPlayers],
  );

  const startAmbient = useCallback(() => {
    isWorkoutActiveRef.current = true;
    currentTrackIndexRef.current = 0;

    if (!audioSettingsLoadedRef.current) {
      pendingAmbientStartRef.current = true;
      return;
    }

    const settings = audioSettingsRef.current;
    const tracks = settings.selectedTracks;
    if (tracks.length === 0) return;

    stopAllAmbient();
    const singleTrack = tracks.length === 1 && !settings.shuffleEnabled;

    if (settings.shuffleEnabled) {
      const track = tracks[Math.floor(Math.random() * tracks.length)];
      playTrackByKey(track, false);
    } else {
      currentTrackIndexRef.current = 1;
      playTrackByKey(tracks[0], singleTrack);
    }
  }, [stopAllAmbient, playTrackByKey]);

  const stopAmbient = useCallback(() => {
    // Cancel any in-flight fade and restore volumes immediately.
    if (fadeIntervalRef.current !== null) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
      const vol = audioSettingsRef.current.ambientVolume;
      for (const player of Object.values(ambientPlayers)) {
        if (player) {
          try {
            player.volume = vol;
          } catch {}
        }
      }
    }
    isWorkoutActiveRef.current = false;
    pendingAmbientStartRef.current = false;
    stopAllAmbient();
    setCurrentAmbientTrack("none");
    lastPlayedTrackRef.current = "none";
    currentTrackIndexRef.current = 0;
  }, [ambientPlayers, stopAllAmbient]);

  const fadeOutAmbient = useCallback(() => {
    isWorkoutActiveRef.current = false;
    pendingAmbientStartRef.current = false;

    // Clear any previously scheduled fade.
    if (fadeIntervalRef.current !== null) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    const track = lastPlayedTrackRef.current;
    if (track === "none") {
      setCurrentAmbientTrack("none");
      currentTrackIndexRef.current = 0;
      return;
    }

    const player = ambientPlayers[track as TrackKey];
    if (!player) {
      stopAllAmbient();
      setCurrentAmbientTrack("none");
      lastPlayedTrackRef.current = "none";
      currentTrackIndexRef.current = 0;
      return;
    }

    const FADE_MS = 3000;
    const STEP_MS = 100;
    const totalSteps = FADE_MS / STEP_MS;
    const startVolume = audioSettingsRef.current.ambientVolume;
    let step = 0;

    fadeIntervalRef.current = setInterval(() => {
      step += 1;
      const fraction = Math.max(0, 1 - step / totalSteps);
      try {
        player.volume = startVolume * fraction;
      } catch {}

      if (step >= totalSteps) {
        clearInterval(fadeIntervalRef.current!);
        fadeIntervalRef.current = null;
        stopAllAmbient();
        // Restore volume so the next workout starts at the right level.
        try {
          player.volume = startVolume;
        } catch {}
        setCurrentAmbientTrack("none");
        lastPlayedTrackRef.current = "none";
        currentTrackIndexRef.current = 0;
      }
    }, STEP_MS);
  }, [ambientPlayers, stopAllAmbient]);

  const previewTrack = useCallback(
    (track: TrackKey) => {
      stopAllAmbient();

      if (previewingTrack === track) {
        setPreviewingTrack("none");
        return;
      }

      const player = ambientPlayers[track];
      if (player) {
        try {
          player.volume = audioSettings.ambientVolume;
          player.loop = false;
          player.seekTo(0);
          player.play();
          setPreviewingTrack(track);
        } catch {}
      }
    },
    [
      previewingTrack,
      audioSettings.ambientVolume,
      ambientPlayers,
      stopAllAmbient,
    ],
  );

  const stopPreview = useCallback(() => {
    stopAllAmbient();
    setPreviewingTrack("none");
  }, [stopAllAmbient]);

  return (
    <AudioContext.Provider
      value={{
        audioSettings,
        updateAudioSettings,
        playSfx,
        startAmbient,
        stopAmbient,
        fadeOutAmbient,
        previewTrack,
        stopPreview,
        previewingTrack,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContext);
}
