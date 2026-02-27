export type BreathworkMode = 'calm' | 'energize' | 'pelvic_floor';

export type BreathPhase = 'inhale' | 'hold_top' | 'exhale' | 'hold_bottom' | 'sigh_inhale' | 'sigh_exhale';

export interface PhaseStep {
  phase: BreathPhase;
  duration: number;
  audioClip: keyof typeof BREATHWORK_AUDIO_SOURCES | null;
  label: string;
}

export interface BreathworkModeConfig {
  id: BreathworkMode;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  totalDuration: number;
  introDuration: number;
  outroDuration: number;
  introClip: keyof typeof BREATHWORK_AUDIO_SOURCES;
  outroClip: keyof typeof BREATHWORK_AUDIO_SOURCES;
  midpointClip?: keyof typeof BREATHWORK_AUDIO_SOURCES;
  midpointTime?: number;
  phases: PhaseStep[];
  cyclesEstimate: number;
}

export const BREATHWORK_COLORS = {
  circle_inhale: '#00B4C5',
  circle_hold_top: '#E0F7FA',
  circle_exhale: '#0D1B2A',
  circle_hold_bottom: '#1A2E42',
  phase_label: '#FFFFFF',
  bg_session: '#0D1B2A',
  timer_text: '#9CA3AF',
};

export const BREATHWORK_AUDIO_SOURCES = {
  calm_intro: require('@/assets/sounds/breathwork/calm_intro.mp3'),
  calm_inhale: require('@/assets/sounds/breathwork/calm_inhale.mp3'),
  calm_hold_top: require('@/assets/sounds/breathwork/calm_hold_top.mp3'),
  calm_exhale: require('@/assets/sounds/breathwork/calm_exhale.mp3'),
  calm_hold_bottom: require('@/assets/sounds/breathwork/calm_hold_bottom.mp3'),
  calm_outro: require('@/assets/sounds/breathwork/calm_outro.mp3'),
  energize_intro: require('@/assets/sounds/breathwork/energize_intro.mp3'),
  energize_sigh_inhale: require('@/assets/sounds/breathwork/energize_sigh_inhale.mp3'),
  energize_sigh_exhale: require('@/assets/sounds/breathwork/energize_sigh_exhale.mp3'),
  energize_transition: require('@/assets/sounds/breathwork/energize_transition.mp3'),
  energize_inhale: require('@/assets/sounds/breathwork/energize_inhale.mp3'),
  energize_exhale: require('@/assets/sounds/breathwork/energize_exhale.mp3'),
  energize_outro: require('@/assets/sounds/breathwork/energize_outro.mp3'),
  pf_intro: require('@/assets/sounds/breathwork/pf_intro.mp3'),
  pf_inhale: require('@/assets/sounds/breathwork/pf_inhale.mp3'),
  pf_exhale: require('@/assets/sounds/breathwork/pf_exhale.mp3'),
  pf_midpoint: require('@/assets/sounds/breathwork/pf_midpoint.mp3'),
  pf_outro: require('@/assets/sounds/breathwork/pf_outro.mp3'),
} as const;

export const CALM_MODE: BreathworkModeConfig = {
  id: 'calm',
  name: 'Calm & Reset',
  subtitle: 'Box Breathing',
  description: 'Symmetrical 4-4-4-4 breathing for stress relief and nervous system reset.',
  icon: 'moon',
  totalDuration: 300,
  introDuration: 15,
  outroDuration: 15,
  introClip: 'calm_intro',
  outroClip: 'calm_outro',
  phases: [
    { phase: 'inhale', duration: 4, audioClip: 'calm_inhale', label: 'BREATHE IN' },
    { phase: 'hold_top', duration: 4, audioClip: 'calm_hold_top', label: 'HOLD' },
    { phase: 'exhale', duration: 4, audioClip: 'calm_exhale', label: 'BREATHE OUT' },
    { phase: 'hold_bottom', duration: 4, audioClip: 'calm_hold_bottom', label: 'HOLD' },
  ],
  cyclesEstimate: 18,
};

export const ENERGIZE_SIGH_PHASES: PhaseStep[] = [
  { phase: 'sigh_inhale', duration: 3, audioClip: 'energize_sigh_inhale', label: 'SNIFF IN' },
  { phase: 'sigh_exhale', duration: 7, audioClip: 'energize_sigh_exhale', label: 'SIGH OUT' },
];

export const ENERGIZE_COHERENCE_PHASES: PhaseStep[] = [
  { phase: 'inhale', duration: 5, audioClip: 'energize_inhale', label: 'BREATHE IN' },
  { phase: 'exhale', duration: 5, audioClip: 'energize_exhale', label: 'BREATHE OUT' },
];

export const ENERGIZE_MODE: BreathworkModeConfig = {
  id: 'energize',
  name: 'Energize & Focus',
  subtitle: 'Physiological Sigh + Coherence',
  description: 'Reset sighs to drop cortisol, then settle into coherence breathing.',
  icon: 'zap',
  totalDuration: 300,
  introDuration: 10,
  outroDuration: 15,
  introClip: 'energize_intro',
  outroClip: 'energize_outro',
  phases: ENERGIZE_COHERENCE_PHASES,
  cyclesEstimate: 24,
};

export const PF_MODE: BreathworkModeConfig = {
  id: 'pelvic_floor',
  name: 'Pelvic Floor Connect',
  subtitle: 'Diaphragmatic + PF Awareness',
  description: 'Connect breath to your pelvic floor with mindful inhale-release, exhale-lift.',
  icon: 'heart',
  totalDuration: 300,
  introDuration: 20,
  outroDuration: 15,
  introClip: 'pf_intro',
  outroClip: 'pf_outro',
  midpointClip: 'pf_midpoint',
  midpointTime: 150,
  phases: [
    { phase: 'inhale', duration: 5, audioClip: 'pf_inhale', label: 'BREATHE IN' },
    { phase: 'exhale', duration: 5, audioClip: 'pf_exhale', label: 'BREATHE OUT' },
  ],
  cyclesEstimate: 30,
};

export const BREATHWORK_MODES: BreathworkModeConfig[] = [CALM_MODE, ENERGIZE_MODE, PF_MODE];

export function getModeConfig(mode: BreathworkMode): BreathworkModeConfig {
  switch (mode) {
    case 'calm': return CALM_MODE;
    case 'energize': return ENERGIZE_MODE;
    case 'pelvic_floor': return PF_MODE;
  }
}
