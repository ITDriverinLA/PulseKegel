import { DayTemplate, Segment, SegmentType } from './workoutProgram';

export interface StandaloneWorkout {
  id: string;
  name: string;
  description: string;
  icon: string;
  accentColor: string;
  estimatedMinutes: number;
  workout: DayTemplate;
}

const createSegment = (
  id: string,
  name: string,
  instructions: string,
  sets: number,
  repsPerSet: number,
  squeezeSeconds: number,
  restSeconds: number,
  type: SegmentType,
  rampSteps?: number[]
): Segment => ({
  id,
  name,
  instructions,
  sets,
  repsPerSet,
  squeezeSeconds,
  restSeconds,
  type,
  rampSteps,
});

const createBlockRest = (id: string, seconds: number = 20): Segment =>
  createSegment(
    id,
    'Block Rest',
    'Breathe deeply and fully relax your pelvic floor',
    1,
    1,
    0,
    seconds,
    'blockRest'
  );

export const standaloneWorkouts: StandaloneWorkout[] = [
  {
    id: 'quick-flicks',
    name: 'Quick Flicks',
    description: 'Fast-paced speed training for muscle responsiveness',
    icon: 'zap',
    accentColor: '#00FFFF',
    estimatedMinutes: 4,
    workout: {
      id: 'standalone-quick-flicks',
      name: 'Quick Flicks',
      dayType: 'speed',
      estimatedMinutes: 4,
      segments: [
        createSegment(
          'qf-warmup',
          'Warm Up',
          'Gentle squeezes to prepare',
          1,
          5,
          2,
          2,
          'slowHolds'
        ),
        createBlockRest('qf-rest1', 15),
        createSegment(
          'qf-main',
          'Quick Flicks',
          'Quick squeeze and release rhythm',
          3,
          15,
          1,
          1,
          'quickFlicks'
        ),
        createBlockRest('qf-rest2', 20),
        createSegment(
          'qf-cooldown',
          'Cool Down',
          'Deep breathing to relax',
          1,
          3,
          3,
          5,
          'breathing'
        ),
      ],
    },
  },
  {
    id: 'slow-holds',
    name: 'Slow Holds',
    description: 'Build strength with sustained contractions',
    icon: 'target',
    accentColor: '#00FF88',
    estimatedMinutes: 6,
    workout: {
      id: 'standalone-slow-holds',
      name: 'Slow Holds',
      dayType: 'strength',
      estimatedMinutes: 6,
      segments: [
        createSegment(
          'sh-warmup',
          'Warm Up',
          'Light squeezes to prepare',
          1,
          4,
          3,
          3,
          'slowHolds'
        ),
        createBlockRest('sh-rest1', 15),
        createSegment(
          'sh-main',
          'Slow Holds',
          'Squeeze firmly and hold, then fully relax',
          2,
          6,
          8,
          10,
          'slowHolds'
        ),
        createBlockRest('sh-rest2', 20),
        createSegment(
          'sh-cooldown',
          'Breathing Reset',
          'Gentle squeeze with deep breaths',
          1,
          4,
          4,
          4,
          'breathing'
        ),
      ],
    },
  },
  {
    id: 'elevator',
    name: 'Elevator',
    description: 'Staged contractions for coordination and control',
    icon: 'trending-up',
    accentColor: '#9D4EDD',
    estimatedMinutes: 5,
    workout: {
      id: 'standalone-elevator',
      name: 'Elevator',
      dayType: 'coordination',
      estimatedMinutes: 5,
      segments: [
        createSegment(
          'el-warmup',
          'Warm Up',
          'Light pulses to prepare',
          1,
          5,
          2,
          2,
          'quickFlicks'
        ),
        createBlockRest('el-rest1', 15),
        createSegment(
          'el-main',
          'Elevator',
          'Step up tension: 25% to 50% to 75% to 100%, then step down',
          2,
          5,
          8,
          10,
          'elevator',
          [0.25, 0.5, 0.75, 1.0]
        ),
        createBlockRest('el-rest2', 20),
        createSegment(
          'el-cooldown',
          'Relaxation',
          'Deep breathing and release',
          1,
          3,
          4,
          5,
          'breathing'
        ),
      ],
    },
  },
  {
    id: 'reverse-kegels',
    name: 'Reverse Kegels',
    description: 'Learn to relax and release tension',
    icon: 'arrow-down',
    accentColor: '#FF9500',
    estimatedMinutes: 5,
    workout: {
      id: 'standalone-reverse',
      name: 'Reverse Kegels',
      dayType: 'coordination',
      estimatedMinutes: 5,
      segments: [
        createSegment(
          'rv-warmup',
          'Awareness',
          'Notice your pelvic floor tension',
          1,
          3,
          4,
          4,
          'slowHolds'
        ),
        createBlockRest('rv-rest1', 15),
        createSegment(
          'rv-main',
          'Reverse Kegels',
          'Gently release and drop tension downward',
          2,
          8,
          5,
          5,
          'reverse'
        ),
        createBlockRest('rv-rest2', 20),
        createSegment(
          'rv-cooldown',
          'Deep Relaxation',
          'Complete release and breathing',
          1,
          5,
          4,
          6,
          'breathing'
        ),
      ],
    },
  },
  {
    id: 'contract-relax',
    name: 'Contract-Relax',
    description: 'Quick contractions with longer rest periods',
    icon: 'activity',
    accentColor: '#FF3366',
    estimatedMinutes: 5,
    workout: {
      id: 'standalone-contract-relax',
      name: 'Contract-Relax',
      dayType: 'strength',
      estimatedMinutes: 5,
      segments: [
        createSegment(
          'cr-warmup',
          'Warm Up',
          'Gentle pulses',
          1,
          5,
          2,
          3,
          'quickFlicks'
        ),
        createBlockRest('cr-rest1', 15),
        createSegment(
          'cr-main',
          'Contract-Relax',
          'Short squeeze with longer relaxation',
          2,
          10,
          2,
          4,
          'contractRelax'
        ),
        createBlockRest('cr-rest2', 20),
        createSegment(
          'cr-cooldown',
          'Breathing',
          'Calm breathing to finish',
          1,
          3,
          3,
          5,
          'breathing'
        ),
      ],
    },
  },
  {
    id: 'full-daily',
    name: 'Full Daily',
    description: 'Complete mixed workout with all exercise types',
    icon: 'layers',
    accentColor: '#00FF88',
    estimatedMinutes: 8,
    workout: {
      id: 'standalone-full-daily',
      name: 'Full Daily',
      dayType: 'daily',
      estimatedMinutes: 8,
      segments: [
        createSegment(
          'fd-slow-holds',
          'Slow Holds',
          'Squeeze firmly and hold, then fully relax',
          1,
          6,
          8,
          10,
          'slowHolds'
        ),
        createBlockRest('fd-rest1', 25),
        createSegment(
          'fd-quick-flicks',
          'Quick Flicks',
          'Quick squeeze and release rhythm',
          1,
          20,
          1,
          1,
          'quickFlicks'
        ),
        createBlockRest('fd-rest2', 25),
        createSegment(
          'fd-contract-relax',
          'Contract-Relax',
          'Short squeeze with longer relaxation',
          1,
          8,
          2,
          4,
          'contractRelax'
        ),
        createBlockRest('fd-rest3', 25),
        createSegment(
          'fd-reverse',
          'Reverse Kegels',
          'Gently release and drop tension downward',
          1,
          8,
          5,
          5,
          'reverse'
        ),
      ],
    },
  },
  {
    id: 'coordination-day',
    name: 'Coordination',
    description: 'Focus on control with elevators and varied rhythms',
    icon: 'sliders',
    accentColor: '#9D4EDD',
    estimatedMinutes: 7,
    workout: {
      id: 'standalone-coordination',
      name: 'Coordination',
      dayType: 'alternate',
      estimatedMinutes: 7,
      segments: [
        createSegment(
          'cd-elevator',
          'Elevators',
          'Step up tension: 25% to 50% to 75% to 100%, then step down',
          1,
          5,
          8,
          12,
          'elevator',
          [0.25, 0.5, 0.75, 1.0]
        ),
        createBlockRest('cd-rest1', 25),
        createSegment(
          'cd-flicks',
          'Quick Flicks',
          'Quick squeeze and release rhythm',
          1,
          25,
          1,
          1,
          'quickFlicks'
        ),
        createBlockRest('cd-rest2', 25),
        createSegment(
          'cd-reverse',
          'Reverse Kegels',
          'Gently release and drop tension downward',
          1,
          10,
          5,
          5,
          'reverse'
        ),
      ],
    },
  },
];
