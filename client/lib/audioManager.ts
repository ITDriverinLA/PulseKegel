export type SoundEffect =
  | "squeeze"
  | "rest"
  | "breathe"
  | "countdown"
  | "complete"
  | "badge";
export type AmbientTrack =
  | "none"
  | "age_weapon_1"
  | "age_weapon_2"
  | "training_beats"
  | "training_kegel"
  | "quiet_power_1"
  | "quiet_power_2"
  | "quiet_power_f1"
  | "quiet_power_f2"
  | "surrender"
  | "on_my_knees"
  | "take_me"
  | "velvet_tides"
  | "rivers_of_surrender"
  | "architect_of_surrender";

export type TrackKey = Exclude<AmbientTrack, "none">;

export interface AudioSettings {
  sfxEnabled: boolean;
  sfxVolume: number;
  ambientVolume: number;
  selectedTracks: TrackKey[];
  shuffleEnabled: boolean;
}

export const ALL_AMBIENT_TRACKS: TrackKey[] = [
  "age_weapon_1",
  "age_weapon_2",
  "training_beats",
  "training_kegel",
  "quiet_power_1",
  "quiet_power_2",
  "quiet_power_f1",
  "quiet_power_f2",
  "surrender",
  "on_my_knees",
  "take_me",
  "velvet_tides",
  "rivers_of_surrender",
  "architect_of_surrender",
];

export const defaultAudioSettings: AudioSettings = {
  sfxEnabled: true,
  sfxVolume: 0.7,
  ambientVolume: 0.3,
  selectedTracks: [],
  shuffleEnabled: false,
};

export const AMBIENT_TRACK_LABELS: Record<AmbientTrack, string> = {
  none: "Off",
  age_weapon_1: "Age Like A Weapon I",
  age_weapon_2: "Age Like A Weapon II",
  training_beats: "Training Beats",
  training_kegel: "Training With A Kegel",
  quiet_power_1: "Quiet Power 1",
  quiet_power_2: "Quiet Power 2",
  quiet_power_f1: "Quiet Power F1",
  quiet_power_f2: "Quiet Power F2",
  surrender: "Surrender",
  on_my_knees: "On My Knees",
  take_me: "Take Me",
  velvet_tides: "Velvet Tides",
  rivers_of_surrender: "Rivers of Surrender",
  architect_of_surrender: "The Architect of Surrender",
};

export const SOUND_SOURCES = {
  squeeze: require("@/assets/sounds/squeeze_start.wav"),
  rest: require("@/assets/sounds/rest_start.wav"),
  breathe: require("@/assets/sounds/breathe_start.wav"),
  countdown: require("@/assets/sounds/countdown_beep.wav"),
  complete: require("@/assets/sounds/workout_complete.wav"),
  badge: require("@/assets/sounds/badge_earned.wav"),
} as const;

export const AMBIENT_SOURCES = {
  age_weapon_1: require("@/assets/sounds/age_like_a_weapon_1.mp3"),
  age_weapon_2: require("@/assets/sounds/age_like_a_weapon_2.mp3"),
  training_beats: require("@/assets/sounds/training_beats.mp3"),
  training_kegel: require("@/assets/sounds/training_with_a_kegel.mp3"),
  quiet_power_1: require("@/assets/sounds/quiet_power_1.mp3"),
  quiet_power_2: require("@/assets/sounds/quiet_power_2.mp3"),
  quiet_power_f1: require("@/assets/sounds/quiet_power_f1.mp3"),
  quiet_power_f2: require("@/assets/sounds/quiet_power_f2.mp3"),
  surrender: require("@/assets/sounds/surrender.mp3"),
  on_my_knees: require("@/assets/sounds/on_my_knees.mp3"),
  take_me: require("@/assets/sounds/take_me.mp3"),
  velvet_tides: require("@/assets/sounds/velvet_tides.mp3"),
  rivers_of_surrender: require("@/assets/sounds/rivers_of_surrender.mp3"),
  architect_of_surrender: require("@/assets/sounds/the_architect_of_surrender.mp3"),
} as const;
