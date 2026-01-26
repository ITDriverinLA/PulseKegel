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
  // Week 1: 5s hold, progressing to 8s by Week 6
  const baseHold = Math.min(5 + Math.floor((weekNum - 1) / 2), 8);
  // Week 1-3: 3 sets, Week 4-6: 4 sets
  const sets = weekNum <= 3 ? 3 : 4;
  // Week 1: 8 reps, gradually increase to 10
  const reps = Math.min(8 + Math.floor((weekNum - 1) / 3), 10);
  // Rest time 5-6 seconds
  const restSeconds = Math.min(5 + Math.floor((weekNum - 1) / 4), 6);
  
  // Calculate estimated time: exercise + set rests + cool down
  const exerciseTime = sets * reps * (baseHold + restSeconds);
  const setRestTime = (sets - 1) * 10; // 10s rest between sets
  const coolDownTime = 30;
  const totalSeconds = exerciseTime + setRestTime + coolDownTime;
  
  return {
    id: `w${weekNum}-strength`,
    name: 'Strength Training',
    dayType: 'strength',
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createSegment(
        `w${weekNum}-slow`,
        'Slow Holds',
        'Squeeze and hold, then fully relax',
        sets,
        reps,
        baseHold,
        restSeconds,
        'slowHolds'
      ),
      createSegment(
        `w${weekNum}-cooldown`,
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

const speedDay = (weekNum: number): DayTemplate => {
  // Week 1: 4 sets, gradually increase to 6
  const sets = Math.min(4 + Math.floor((weekNum - 1) / 3), 6);
  // Week 1: 30 reps, gradually increase to 40
  const reps = Math.min(30 + Math.floor((weekNum - 1) / 2) * 2, 40);
  
  // Calculate estimated time: exercise + set rests + cool down
  const exerciseTime = sets * reps * 2; // 1s squeeze + 1s rest
  const setRestTime = (sets - 1) * 10; // 10s rest between sets
  const coolDownTime = 30;
  const totalSeconds = exerciseTime + setRestTime + coolDownTime;
  
  return {
    id: `w${weekNum}-speed`,
    name: 'Speed Training',
    dayType: 'speed',
    estimatedMinutes: Math.ceil(totalSeconds / 60),
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
        `w${weekNum}-cooldown`,
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
  // Week 3: 2 sets, gradually increase to 4
  const sets = Math.min(2 + Math.floor((weekNum - 1) / 3), 4);
  // Elevator reps start at 5, increase to 8
  const elevatorReps = Math.min(5 + Math.floor((weekNum - 1) / 2), 8);
  // Hold time for elevator steps
  const elevatorHold = Math.min(6 + Math.floor((weekNum - 1) / 2), 10);
  // Final hold increases with weeks
  const finalHold = Math.min(8 + weekNum, 15);
  
  // Calculate estimated time
  const elevatorTime = sets * elevatorReps * (elevatorHold + 6); // hold + rest
  const reverseTime = Math.max(1, sets - 1) * 4 * (5 + 5); // 4 reps × (5s + 5s)
  const finalTime = finalHold + 5;
  const setRestTime = (sets - 1) * 10;
  const coolDownTime = 30;
  const totalSeconds = elevatorTime + reverseTime + finalTime + setRestTime + coolDownTime;
  
  return {
    id: `w${weekNum}-coordination`,
    name: 'Coordination',
    dayType: 'coordination',
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createSegment(
        `w${weekNum}-elevator`,
        'Elevator',
        'Step up tension: 25% to 50% to 75% to 100%',
        sets,
        elevatorReps,
        elevatorHold,
        6,
        'elevator',
        [0.25, 0.5, 0.75, 1.0]
      ),
      createSegment(
        `w${weekNum}-reverse`,
        'Reverse Kegels',
        'Gently release and drop tension',
        Math.max(1, sets - 1),
        4,
        5,
        5,
        'reverse'
      ),
      createSegment(
        `w${weekNum}-final`,
        'Final Hold',
        'One strong hold to finish',
        1,
        1,
        finalHold,
        5,
        'slowHolds'
      ),
      createSegment(
        `w${weekNum}-coord-cooldown`,
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
