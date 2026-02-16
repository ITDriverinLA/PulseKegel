export type SoundEffect = 'squeeze' | 'rest' | 'breathe' | 'countdown' | 'complete' | 'badge';
export type AmbientTrack = 'none' | 'calm' | 'focused';

export interface AudioSettings {
  sfxEnabled: boolean;
  sfxVolume: number;
  ambientTrack: AmbientTrack;
  ambientVolume: number;
}

export const defaultAudioSettings: AudioSettings = {
  sfxEnabled: true,
  sfxVolume: 0.7,
  ambientTrack: 'none',
  ambientVolume: 0.3,
};

export const SOUND_SOURCES = {
  squeeze: require('@/assets/sounds/squeeze_start.wav'),
  rest: require('@/assets/sounds/rest_start.wav'),
  breathe: require('@/assets/sounds/breathe_start.wav'),
  countdown: require('@/assets/sounds/countdown_beep.wav'),
  complete: require('@/assets/sounds/workout_complete.wav'),
  badge: require('@/assets/sounds/badge_earned.wav'),
} as const;

export const AMBIENT_SOURCES = {
  calm: require('@/assets/sounds/ambient_calm.wav'),
  focused: require('@/assets/sounds/ambient_focused.wav'),
} as const;
