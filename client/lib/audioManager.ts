export type SoundEffect = 'squeeze' | 'rest' | 'breathe' | 'countdown' | 'complete' | 'badge';
export type AmbientTrack = 'none' | 'age_weapon_1' | 'age_weapon_2' | 'training_beats' | 'training_kegel' | 'quiet_power_1' | 'quiet_power_2' | 'quiet_power_f1' | 'quiet_power_f2';

export type ShuffleMode = 'off' | 'all' | 'selected';

export interface AudioSettings {
  sfxEnabled: boolean;
  sfxVolume: number;
  ambientTrack: AmbientTrack;
  ambientVolume: number;
  shuffleMode: ShuffleMode;
  shuffleEnabledTracks: Exclude<AmbientTrack, 'none'>[];
}

export const ALL_AMBIENT_TRACKS: Exclude<AmbientTrack, 'none'>[] = [
  'age_weapon_1',
  'age_weapon_2',
  'training_beats',
  'training_kegel',
  'quiet_power_1',
  'quiet_power_2',
  'quiet_power_f1',
  'quiet_power_f2',
];

export const defaultAudioSettings: AudioSettings = {
  sfxEnabled: true,
  sfxVolume: 0.7,
  ambientTrack: 'none',
  ambientVolume: 0.3,
  shuffleMode: 'off',
  shuffleEnabledTracks: [...ALL_AMBIENT_TRACKS],
};

export const AMBIENT_TRACK_LABELS: Record<AmbientTrack, string> = {
  none: 'Off',
  age_weapon_1: 'Age Like A Weapon I',
  age_weapon_2: 'Age Like A Weapon II',
  training_beats: 'Training Beats',
  training_kegel: 'Training With A Kegel',
  quiet_power_1: 'Quiet Power 1',
  quiet_power_2: 'Quiet Power 2',
  quiet_power_f1: 'Quiet Power F1',
  quiet_power_f2: 'Quiet Power F2',
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
  quiet_power_1: require('@/assets/sounds/quiet_power_1.mp3'),
  quiet_power_2: require('@/assets/sounds/quiet_power_2.mp3'),
  quiet_power_f1: require('@/assets/sounds/quiet_power_f1.mp3'),
  quiet_power_f2: require('@/assets/sounds/quiet_power_f2.mp3'),
} as const;
