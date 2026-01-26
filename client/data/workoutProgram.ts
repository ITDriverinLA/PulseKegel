export type SegmentType = 'slowHolds' | 'quickFlicks' | 'elevator' | 'reverse' | 'breathing' | 'blockRest' | 'contractRelax';

export interface Segment {
  id: string;
  name: string;
  instructions: string;
  sets: number;
  repsPerSet: number;
  squeezeSeconds: number;
  restSeconds: number;
  type: SegmentType;
  rampSteps?: number[];
}

export interface DayTemplate {
  id: string;
  name: string;
  dayType: 'strength' | 'speed' | 'coordination' | 'rest' | 'daily' | 'alternate';
  segments: Segment[];
  estimatedMinutes: number;
}

export interface Week {
  weekNumber: number;
  phase: string;
  phaseDescription: string;
  days: DayTemplate[];
}

export interface WorkoutProgram {
  name: string;
  weeks: Week[];
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

const createBlockRest = (id: string): Segment =>
  createSegment(
    id,
    'Block Rest',
    'Breathe deeply and fully relax your pelvic floor',
    1,
    1,
    0,
    25,
    'blockRest'
  );

const dailyDriverWorkout = (weekNum: number): DayTemplate => {
  return {
    id: `w${weekNum}-daily`,
    name: 'Daily Driver',
    dayType: 'daily',
    estimatedMinutes: 8,
    segments: [
      createSegment(
        `w${weekNum}-slow-holds`,
        'Slow Holds',
        'Squeeze firmly and hold, then fully relax',
        1,
        8,
        8,
        12,
        'slowHolds'
      ),
      createBlockRest(`w${weekNum}-rest1`),
      createSegment(
        `w${weekNum}-quick-flicks`,
        'Quick Flicks',
        'Quick squeeze and release rhythm',
        1,
        20,
        1,
        1,
        'quickFlicks'
      ),
      createBlockRest(`w${weekNum}-rest2`),
      createSegment(
        `w${weekNum}-contract-relax`,
        'Contract-Relax',
        'Short squeeze with longer relaxation',
        1,
        10,
        2,
        4,
        'contractRelax'
      ),
      createBlockRest(`w${weekNum}-rest3`),
      createSegment(
        `w${weekNum}-reverse`,
        'Reverse Kegels',
        'Gently release and drop tension downward',
        1,
        10,
        5,
        5,
        'reverse'
      ),
    ],
  };
};

const alternateDayWorkout = (weekNum: number): DayTemplate => {
  return {
    id: `w${weekNum}-alternate`,
    name: 'Coordination Day',
    dayType: 'alternate',
    estimatedMinutes: 7,
    segments: [
      createSegment(
        `w${weekNum}-elevator`,
        'Elevators',
        'Step up tension: 25% to 50% to 75% to 100%, then step down',
        1,
        5,
        8,
        12,
        'elevator',
        [0.25, 0.5, 0.75, 1.0]
      ),
      createBlockRest(`w${weekNum}-alt-rest1`),
      createSegment(
        `w${weekNum}-alt-flicks`,
        'Quick Flicks',
        'Quick squeeze and release rhythm',
        1,
        30,
        1,
        1,
        'quickFlicks'
      ),
      createBlockRest(`w${weekNum}-alt-rest2`),
      createSegment(
        `w${weekNum}-alt-reverse`,
        'Reverse Kegels',
        'Gently release and drop tension downward',
        1,
        12,
        5,
        5,
        'reverse'
      ),
    ],
  };
};

const strengthDay = (weekNum: number): DayTemplate => {
  const baseHold = Math.min(3 + Math.floor(weekNum / 2), 10);
  const sets = Math.min(2 + Math.floor(weekNum / 3), 5);
  const reps = Math.min(5 + Math.floor(weekNum / 2), 10);
  
  return {
    id: `w${weekNum}-strength`,
    name: 'Strength Training',
    dayType: 'strength',
    estimatedMinutes: Math.ceil((sets * reps * (baseHold + 3)) / 60) + 2,
    segments: [
      createSegment(
        `w${weekNum}-slow`,
        'Slow Holds',
        'Squeeze and hold, then fully relax',
        sets,
        reps,
        baseHold,
        3,
        'slowHolds'
      ),
      createSegment(
        `w${weekNum}-breathing`,
        'Breathing Reset',
        'Gentle squeeze with deep breaths',
        1,
        3,
        4,
        4,
        'breathing'
      ),
    ],
  };
};

const speedDay = (weekNum: number): DayTemplate => {
  const sets = Math.min(3 + Math.floor(weekNum / 4), 6);
  const reps = Math.min(8 + weekNum, 20);
  
  return {
    id: `w${weekNum}-speed`,
    name: 'Speed Training',
    dayType: 'speed',
    estimatedMinutes: Math.ceil((sets * reps * 2) / 60) + 2,
    segments: [
      createSegment(
        `w${weekNum}-flicks`,
        'Quick Flicks',
        'Quick squeeze and release rhythm',
        sets,
        reps,
        1,
        1,
        'quickFlicks'
      ),
      createSegment(
        `w${weekNum}-recovery`,
        'Cool Down',
        'Relax and breathe deeply',
        1,
        1,
        0,
        30,
        'breathing'
      ),
    ],
  };
};

const coordinationDay = (weekNum: number): DayTemplate => {
  const sets = Math.min(2 + Math.floor(weekNum / 4), 4);
  
  return {
    id: `w${weekNum}-coordination`,
    name: 'Coordination',
    dayType: 'coordination',
    estimatedMinutes: Math.ceil((sets * 4 * 8) / 60) + 3,
    segments: [
      createSegment(
        `w${weekNum}-elevator`,
        'Elevator',
        'Gradually increase tension in steps',
        sets,
        4,
        2,
        2,
        'elevator',
        [0.25, 0.5, 0.75, 1.0]
      ),
      createSegment(
        `w${weekNum}-reverse`,
        'Reverse Elevator',
        'Gradually decrease tension',
        Math.max(1, sets - 1),
        3,
        2,
        2,
        'reverse',
        [1.0, 0.75, 0.5, 0.25]
      ),
      createSegment(
        `w${weekNum}-final`,
        'Final Hold',
        'One strong hold to finish',
        1,
        1,
        Math.min(5 + weekNum, 15),
        5,
        'slowHolds'
      ),
    ],
  };
};

const generateWeek = (weekNum: number): Week => {
  let phase: string;
  let phaseDescription: string;
  
  if (weekNum <= 2) {
    phase = 'Control';
    phaseDescription = 'Building awareness and control';
  } else if (weekNum <= 6) {
    phase = 'Strength';
    phaseDescription = 'Increasing hold duration and reps';
  } else if (weekNum <= 10) {
    phase = 'Power';
    phaseDescription = 'Block-based training for power and endurance';
  } else {
    phase = 'Maintenance';
    phaseDescription = 'Maintaining your progress';
  }
  
  const days: DayTemplate[] = [];
  
  if (weekNum <= 2) {
    days.push(strengthDay(weekNum));
    days.push(strengthDay(weekNum));
    days.push(speedDay(weekNum));
  } else if (weekNum <= 6) {
    days.push(strengthDay(weekNum));
    days.push(speedDay(weekNum));
    days.push(strengthDay(weekNum));
    days.push(speedDay(weekNum));
    days.push(coordinationDay(weekNum));
  } else if (weekNum <= 10) {
    days.push(dailyDriverWorkout(weekNum));
    days.push(alternateDayWorkout(weekNum));
    days.push(dailyDriverWorkout(weekNum));
    days.push(alternateDayWorkout(weekNum));
    days.push(dailyDriverWorkout(weekNum));
    days.push(dailyDriverWorkout(weekNum));
    days.push(dailyDriverWorkout(weekNum));
  } else {
    days.push(dailyDriverWorkout(weekNum));
    days.push(alternateDayWorkout(weekNum));
    days.push(dailyDriverWorkout(weekNum));
    days.push(dailyDriverWorkout(weekNum));
    days.push(dailyDriverWorkout(weekNum));
  }
  
  return {
    weekNumber: weekNum,
    phase,
    phaseDescription,
    days,
  };
};

export const workoutProgram: WorkoutProgram = {
  name: 'PulseKegel 12-Week Program',
  weeks: Array.from({ length: 12 }, (_, i) => generateWeek(i + 1)),
};

export const getTodaysWorkout = (
  completedDates: string[],
  startDate?: string
): { week: Week; dayIndex: number; workout: DayTemplate } | null => {
  const today = new Date();
  const start = startDate ? new Date(startDate) : new Date(today);
  
  if (!startDate) {
    start.setDate(start.getDate() - completedDates.length);
  }
  
  const daysSinceStart = Math.floor(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  let totalDays = 0;
  for (const week of workoutProgram.weeks) {
    for (let i = 0; i < week.days.length; i++) {
      if (totalDays === daysSinceStart % getTotalProgramDays()) {
        return { week, dayIndex: i, workout: week.days[i] };
      }
      totalDays++;
    }
  }
  
  const firstWeek = workoutProgram.weeks[0];
  return { week: firstWeek, dayIndex: 0, workout: firstWeek.days[0] };
};

export const getTotalProgramDays = (): number => {
  return workoutProgram.weeks.reduce((acc, week) => acc + week.days.length, 0);
};

export const getWorkoutForRecoveryMode = (workout: DayTemplate): DayTemplate => {
  return {
    ...workout,
    segments: [
      ...workout.segments.map(segment => {
        if (segment.type === 'blockRest') {
          return {
            ...segment,
            restSeconds: segment.restSeconds + 5,
          };
        }
        return {
          ...segment,
          sets: Math.max(1, Math.floor(segment.sets * 0.5)),
          repsPerSet: Math.max(1, Math.ceil(segment.repsPerSet * 0.7)),
          squeezeSeconds: Math.max(2, Math.floor(segment.squeezeSeconds * 0.75)),
          restSeconds: segment.restSeconds + 2,
        };
      }),
      createSegment(
        'recovery-breathing',
        'Relaxation',
        'Deep breathing and full relaxation',
        1,
        5,
        3,
        5,
        'breathing'
      ),
    ],
    estimatedMinutes: Math.ceil(workout.estimatedMinutes * 0.6) + 2,
  };
};
