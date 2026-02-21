import React, { createContext, useContext, useCallback, useEffect, useState, useRef, ReactNode } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { storage } from '@/lib/storage';
import {
  SoundEffect,
  AmbientTrack,
  AudioSettings,
  defaultAudioSettings,
  SOUND_SOURCES,
  AMBIENT_SOURCES,
  ALL_AMBIENT_TRACKS,
} from '@/lib/audioManager';

interface AudioContextType {
  audioSettings: AudioSettings;
  updateAudioSettings: (updates: Partial<AudioSettings>) => Promise<void>;
  playSfx: (effect: SoundEffect) => void;
  startAmbient: () => void;
  stopAmbient: () => void;
  previewTrack: (track: Exclude<AmbientTrack, 'none'>) => void;
  stopPreview: () => void;
  previewingTrack: AmbientTrack;
}

const AudioContext = createContext<AudioContextType>({
  audioSettings: defaultAudioSettings,
  updateAudioSettings: async () => {},
  playSfx: () => {},
  startAmbient: () => {},
  stopAmbient: () => {},
  previewTrack: () => {},
  stopPreview: () => {},
  previewingTrack: 'none',
});

export function AudioProvider({ children }: { children: ReactNode }) {
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(defaultAudioSettings);
  const [currentAmbientTrack, setCurrentAmbientTrack] = useState<AmbientTrack>('none');
  const [previewingTrack, setPreviewingTrack] = useState<AmbientTrack>('none');
  const lastShuffleTrackRef = useRef<AmbientTrack>('none');
  const isWorkoutActiveRef = useRef(false);
  const audioSettingsRef = useRef<AudioSettings>(defaultAudioSettings);

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

  const sfxPlayers: Record<SoundEffect, typeof squeezePlayer> = {
    squeeze: squeezePlayer,
    rest: restPlayer,
    breathe: breathePlayer,
    countdown: countdownPlayer,
    complete: completePlayer,
    badge: badgePlayer,
  };

  const ambientPlayers: Record<Exclude<AmbientTrack, 'none'>, typeof ageWeapon1Player> = {
    age_weapon_1: ageWeapon1Player,
    age_weapon_2: ageWeapon2Player,
    training_beats: trainingBeatsPlayer,
    training_kegel: trainingKegelPlayer,
    quiet_power_1: quietPower1Player,
    quiet_power_2: quietPower2Player,
    quiet_power_f1: quietPowerF1Player,
    quiet_power_f2: quietPowerF2Player,
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      } catch {}
      const settings = await storage.getAudioSettings();
      const merged = { ...defaultAudioSettings, ...settings } as AudioSettings;
      if (!merged.shuffleEnabledTracks) {
        merged.shuffleEnabledTracks = [...ALL_AMBIENT_TRACKS];
      }
      setAudioSettings(merged);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    for (const player of Object.values(sfxPlayers)) {
      if (player) {
        player.volume = audioSettings.sfxVolume;
      }
    }
  }, [audioSettings.sfxVolume]);

  useEffect(() => {
    for (const player of Object.values(ambientPlayers)) {
      if (player) {
        player.volume = audioSettings.ambientVolume;
      }
    }
  }, [audioSettings.ambientVolume]);

  const stopAllAmbient = useCallback(() => {
    for (const player of Object.values(ambientPlayers)) {
      if (player) {
        try {
          player.pause();
          player.seekTo(0);
        } catch {}
      }
    }
  }, []);

  const getShufflePool = useCallback((): Exclude<AmbientTrack, 'none'>[] => {
    const settings = audioSettingsRef.current;
    if (settings.shuffleMode === 'all') {
      return [...ALL_AMBIENT_TRACKS];
    }
    if (settings.shuffleMode === 'selected') {
      return settings.shuffleEnabledTracks.length > 0
        ? [...settings.shuffleEnabledTracks]
        : [...ALL_AMBIENT_TRACKS];
    }
    return [];
  }, []);

  const pickRandomTrack = useCallback((pool: Exclude<AmbientTrack, 'none'>[], exclude?: AmbientTrack): Exclude<AmbientTrack, 'none'> => {
    const filtered = pool.filter(t => t !== exclude);
    const candidates = filtered.length > 0 ? filtered : pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, []);

  const playTrack = useCallback((track: Exclude<AmbientTrack, 'none'>, loop: boolean) => {
    const player = ambientPlayers[track];
    if (player) {
      try {
        player.loop = loop;
        player.volume = audioSettingsRef.current.ambientVolume;
        player.seekTo(0);
        player.play();
        setCurrentAmbientTrack(track);
        lastShuffleTrackRef.current = track;
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!isWorkoutActiveRef.current) return;
    const settings = audioSettingsRef.current;
    if (settings.shuffleMode === 'off') return;

    const checkInterval = setInterval(() => {
      if (!isWorkoutActiveRef.current) return;
      const current = lastShuffleTrackRef.current;
      if (current === 'none') return;
      const player = ambientPlayers[current as Exclude<AmbientTrack, 'none'>];
      if (player && !player.playing && player.currentTime > 0) {
        const pool = getShufflePool();
        if (pool.length > 0) {
          const next = pickRandomTrack(pool, current);
          stopAllAmbient();
          playTrack(next, false);
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [audioSettings.shuffleMode, currentAmbientTrack]);

  const updateAudioSettings = useCallback(async (updates: Partial<AudioSettings>) => {
    const newSettings = { ...audioSettings, ...updates };
    setAudioSettings(newSettings);
    await storage.saveAudioSettings(newSettings);

    if (updates.ambientTrack !== undefined && updates.ambientTrack !== currentAmbientTrack) {
      if (currentAmbientTrack !== 'none') {
        const oldPlayer = ambientPlayers[currentAmbientTrack];
        if (oldPlayer) {
          oldPlayer.pause();
          oldPlayer.seekTo(0);
        }
      }
    }
  }, [audioSettings, currentAmbientTrack]);

  const playSfx = useCallback((effect: SoundEffect) => {
    if (!audioSettings.sfxEnabled) return;
    const player = sfxPlayers[effect];
    if (player) {
      try {
        player.seekTo(0);
        player.volume = audioSettings.sfxVolume;
        player.play();
      } catch {}
    }
  }, [audioSettings.sfxEnabled, audioSettings.sfxVolume]);

  const startAmbient = useCallback(() => {
    isWorkoutActiveRef.current = true;
    const settings = audioSettingsRef.current;

    if (settings.shuffleMode !== 'off') {
      const pool = getShufflePool();
      if (pool.length > 0) {
        const track = pickRandomTrack(pool);
        stopAllAmbient();
        playTrack(track, false);
        return;
      }
    }

    const track = settings.ambientTrack;
    if (track === 'none') return;
    stopAllAmbient();
    playTrack(track, true);
  }, []);

  const stopAmbient = useCallback(() => {
    isWorkoutActiveRef.current = false;
    stopAllAmbient();
    setCurrentAmbientTrack('none');
    lastShuffleTrackRef.current = 'none';
  }, []);

  const previewTrack = useCallback((track: Exclude<AmbientTrack, 'none'>) => {
    stopAllAmbient();

    if (previewingTrack === track) {
      setPreviewingTrack('none');
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
  }, [previewingTrack, audioSettings.ambientVolume]);

  const stopPreview = useCallback(() => {
    stopAllAmbient();
    setPreviewingTrack('none');
  }, []);

  return (
    <AudioContext.Provider
      value={{
        audioSettings,
        updateAudioSettings,
        playSfx,
        startAmbient,
        stopAmbient,
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
