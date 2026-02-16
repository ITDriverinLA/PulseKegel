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
} from '@/lib/audioManager';

interface AudioContextType {
  audioSettings: AudioSettings;
  updateAudioSettings: (updates: Partial<AudioSettings>) => Promise<void>;
  playSfx: (effect: SoundEffect) => void;
  startAmbient: () => void;
  stopAmbient: () => void;
}

const AudioContext = createContext<AudioContextType>({
  audioSettings: defaultAudioSettings,
  updateAudioSettings: async () => {},
  playSfx: () => {},
  startAmbient: () => {},
  stopAmbient: () => {},
});

export function AudioProvider({ children }: { children: ReactNode }) {
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(defaultAudioSettings);
  const [currentAmbientTrack, setCurrentAmbientTrack] = useState<AmbientTrack>('none');

  const squeezePlayer = useAudioPlayer(SOUND_SOURCES.squeeze);
  const restPlayer = useAudioPlayer(SOUND_SOURCES.rest);
  const breathePlayer = useAudioPlayer(SOUND_SOURCES.breathe);
  const countdownPlayer = useAudioPlayer(SOUND_SOURCES.countdown);
  const completePlayer = useAudioPlayer(SOUND_SOURCES.complete);
  const badgePlayer = useAudioPlayer(SOUND_SOURCES.badge);
  const ambientCalmPlayer = useAudioPlayer(AMBIENT_SOURCES.calm);
  const ambientFocusedPlayer = useAudioPlayer(AMBIENT_SOURCES.focused);

  const sfxPlayers: Record<SoundEffect, typeof squeezePlayer> = {
    squeeze: squeezePlayer,
    rest: restPlayer,
    breathe: breathePlayer,
    countdown: countdownPlayer,
    complete: completePlayer,
    badge: badgePlayer,
  };

  const ambientPlayers: Record<Exclude<AmbientTrack, 'none'>, typeof ambientCalmPlayer> = {
    calm: ambientCalmPlayer,
    focused: ambientFocusedPlayer,
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      } catch {}
      const settings = await storage.getAudioSettings();
      setAudioSettings(settings as AudioSettings);
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
        player.loop = true;
      }
    }
  }, [audioSettings.ambientVolume]);

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
    const track = audioSettings.ambientTrack;
    if (track === 'none') return;
    const player = ambientPlayers[track];
    if (player) {
      try {
        player.loop = true;
        player.volume = audioSettings.ambientVolume;
        player.play();
        setCurrentAmbientTrack(track);
      } catch {}
    }
  }, [audioSettings.ambientTrack, audioSettings.ambientVolume]);

  const stopAmbient = useCallback(() => {
    for (const player of Object.values(ambientPlayers)) {
      if (player) {
        try {
          player.pause();
          player.seekTo(0);
        } catch {}
      }
    }
    setCurrentAmbientTrack('none');
  }, []);

  return (
    <AudioContext.Provider
      value={{
        audioSettings,
        updateAudioSettings,
        playSfx,
        startAmbient,
        stopAmbient,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContext);
}
