export type SoundEffect = 'squeeze' | 'rest' | 'breathe' | 'countdown' | 'complete' | 'badge';
export type AmbientTrack = 'none' | 'age_weapon_1' | 'age_weapon_2' | 'training_beats' | 'training_kegel';

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

export const AMBIENT_TRACK_LABELS: Record<AmbientTrack, string> = {
  none: 'Off',
  age_weapon_1: 'Age Like A Weapon I',
  age_weapon_2: 'Age Like A Weapon II',
  training_beats: 'Training Beats',
  training_kegel: 'Training With A Kegel',
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
  age_weapon_1: require('@/assets/sounds/age_like_a_weapon_1.mp3'),
  age_weapon_2: require('@/assets/sounds/age_like_a_weapon_2.mp3'),
  training_beats: require('@/assets/sounds/training_beats.mp3'),
  training_kegel: require('@/assets/sounds/training_with_a_kegel.mp3'),
} as const;
