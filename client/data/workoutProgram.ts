export type SegmentType =
  | "slowHolds"
  | "quickFlicks"
  | "elevator"
  | "reverse"
  | "breathing"
  | "blockRest"
  | "contractRelax"
  | "getReady";

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
  dayType:
    | "strength"
    | "speed"
    | "coordination"
    | "rest"
    | "daily"
    | "alternate";
  segments: Segment[];
  estimatedMinutes: number;
  isRestDay?: boolean;
}

const createRestDay = (weekNum: number, dayNum: number): DayTemplate => ({
  id: `w${weekNum}-rest-${dayNum}`,
  name: "Rest Day",
  dayType: "rest",
  segments: [],
  estimatedMinutes: 0,
  isRestDay: true,
});

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
  rampSteps?: number[],
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
    "Block Rest",
    "Breathe deeply and fully relax your pelvic floor",
    1,
    1,
    0,
    25,
    "blockRest",
  );

const createGetReady = (id: string): Segment =>
  createSegment(
    id,
    "Get Ready",
    "Prepare yourself for the workout",
    1,
    1,
    0,
    5,
    "getReady",
  );

const dailyDriverWorkout = (weekNum: number): DayTemplate => {
  return {
    id: `w${weekNum}-daily`,
    name: "Daily Driver",
    dayType: "daily",
    estimatedMinutes: 8,
    segments: [
      createGetReady(`w${weekNum}-getready`),
      createSegment(
        `w${weekNum}-slow-holds`,
        "Slow Holds",
        "Squeeze firmly and hold, then fully relax",
        1,
        8,
        8,
        12,
        "slowHolds",
      ),
      createBlockRest(`w${weekNum}-rest1`),
      createSegment(
        `w${weekNum}-quick-flicks`,
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        1,
        20,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest(`w${weekNum}-rest2`),
      createSegment(
        `w${weekNum}-contract-relax`,
        "Contract-Relax",
        "Short squeeze with longer relaxation",
        1,
        10,
        2,
        4,
        "contractRelax",
      ),
      createBlockRest(`w${weekNum}-rest3`),
      createSegment(
        `w${weekNum}-reverse`,
        "Reverse Kegels",
        "Gently release and drop tension downward",
        1,
        10,
        5,
        5,
        "reverse",
      ),
    ],
  };
};

const alternateDayWorkout = (weekNum: number): DayTemplate => {
  return {
    id: `w${weekNum}-alternate`,
    name: "Coordination Day",
    dayType: "alternate",
    estimatedMinutes: 7,
    segments: [
      createGetReady(`w${weekNum}-alt-getready`),
      createSegment(
        `w${weekNum}-elevator`,
        "Elevators",
        "Step up tension: 25% to 50% to 75% to 100%, then step down",
        1,
        5,
        8,
        12,
        "elevator",
        [0.25, 0.5, 0.75, 1.0],
      ),
      createBlockRest(`w${weekNum}-alt-rest1`),
      createSegment(
        `w${weekNum}-alt-flicks`,
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        1,
        30,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest(`w${weekNum}-alt-rest2`),
      createSegment(
        `w${weekNum}-alt-reverse`,
        "Reverse Kegels",
        "Gently release and drop tension downward",
        1,
        12,
        5,
        5,
        "reverse",
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

  // Quick flicks reps (shorter burst after slow holds)
  const flickReps = Math.min(10 + weekNum * 2, 20);
  // Reverse kegel reps
  const reverseReps = Math.min(4 + Math.floor(weekNum / 2), 8);

  // Calculate time with all exercises
  const slowHoldTime = sets * reps * (baseHold + restSeconds);
  const flickTime = flickReps * 2; // 1s squeeze + 1s rest
  const reverseTime = reverseReps * 8; // 4s release + 4s rest
  const blockRestTime = 20; // breathing break between exercises
  const coolDownTime = 20;
  const totalSeconds =
    slowHoldTime +
    blockRestTime +
    flickTime +
    blockRestTime +
    reverseTime +
    coolDownTime;

  return {
    id: `w${weekNum}-strength`,
    name: "Strength Training",
    dayType: "strength",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady(`w${weekNum}-str-getready`),
      createSegment(
        `w${weekNum}-slow`,
        "Slow Holds",
        "Squeeze and hold, then fully relax",
        sets,
        reps,
        baseHold,
        restSeconds,
        "slowHolds",
      ),
      createBlockRest(`w${weekNum}-str-rest1`),
      createSegment(
        `w${weekNum}-flicks`,
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        1,
        flickReps,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest(`w${weekNum}-str-rest2`),
      createSegment(
        `w${weekNum}-reverse`,
        "Reverse Kegels",
        "Gently release and drop tension",
        1,
        reverseReps,
        4,
        4,
        "reverse",
      ),
      createSegment(
        `w${weekNum}-cooldown`,
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        0,
        20,
        "breathing",
      ),
    ],
  };
};

const speedDay = (weekNum: number): DayTemplate => {
  // Week 1: 3 sets of quick flicks, gradually increase
  const flickSets = Math.min(3 + Math.floor((weekNum - 1) / 3), 5);
  // Week 1: 25 reps per set, gradually increase to 35
  const flickReps = Math.min(25 + Math.floor((weekNum - 1) / 2) * 2, 35);
  // Contract-relax reps
  const contractReps = Math.min(8 + weekNum, 14);
  // Slow hold reps (fewer, for contrast)
  const slowReps = Math.min(5 + Math.floor(weekNum / 2), 10);
  const slowHold = Math.min(4 + Math.floor(weekNum / 3), 6);

  // Calculate estimated time with all exercises
  const flickTime = flickSets * flickReps * 2; // 1s squeeze + 1s rest
  const contractTime = contractReps * 6; // 2s squeeze + 4s rest
  const slowTime = slowReps * (slowHold + 4); // hold + rest
  const blockRestTime = 20;
  const coolDownTime = 20;
  const totalSeconds =
    flickTime +
    blockRestTime +
    contractTime +
    blockRestTime +
    slowTime +
    coolDownTime;

  return {
    id: `w${weekNum}-speed`,
    name: "Speed Training",
    dayType: "speed",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady(`w${weekNum}-spd-getready`),
      createSegment(
        `w${weekNum}-flicks`,
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        flickSets,
        flickReps,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest(`w${weekNum}-spd-rest1`),
      createSegment(
        `w${weekNum}-contract`,
        "Contract-Relax",
        "Short squeeze with longer relaxation",
        1,
        contractReps,
        2,
        4,
        "contractRelax",
      ),
      createBlockRest(`w${weekNum}-spd-rest2`),
      createSegment(
        `w${weekNum}-slow`,
        "Slow Holds",
        "Squeeze and hold for control",
        1,
        slowReps,
        slowHold,
        4,
        "slowHolds",
      ),
      createSegment(
        `w${weekNum}-cooldown`,
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        0,
        20,
        "breathing",
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
  const coolDownTime = 20;
  const totalSeconds =
    elevatorTime + reverseTime + finalTime + setRestTime + coolDownTime;

  return {
    id: `w${weekNum}-coordination`,
    name: "Coordination",
    dayType: "coordination",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady(`w${weekNum}-coord-getready`),
      createSegment(
        `w${weekNum}-elevator`,
        "Elevator",
        "Step up tension: 25% to 50% to 75% to 100%",
        sets,
        elevatorReps,
        elevatorHold,
        6,
        "elevator",
        [0.25, 0.5, 0.75, 1.0],
      ),
      createSegment(
        `w${weekNum}-reverse`,
        "Reverse Kegels",
        "Gently release and drop tension",
        Math.max(1, sets - 1),
        4,
        5,
        5,
        "reverse",
      ),
      createSegment(
        `w${weekNum}-final`,
        "Final Hold",
        "One strong hold to finish",
        1,
        1,
        finalHold,
        5,
        "slowHolds",
      ),
      createSegment(
        `w${weekNum}-coord-cooldown`,
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        0,
        20,
        "breathing",
      ),
    ],
  };
};

const generateWeek = (weekNum: number): Week => {
  let phase: string;
  let phaseDescription: string;

  if (weekNum <= 2) {
    phase = "Control";
    phaseDescription = "Building awareness and control";
  } else if (weekNum <= 6) {
    phase = "Strength";
    phaseDescription = "Increasing hold duration and reps";
  } else if (weekNum <= 10) {
    phase = "Power";
    phaseDescription = "Block-based training for power and endurance";
  } else {
    phase = "Maintenance";
    phaseDescription = "Maintaining your progress";
  }

  const days: DayTemplate[] = [];

  if (weekNum <= 2) {
    // Weeks 1-2: 3 workouts, 4 rest days (Mon/Wed/Fri pattern)
    // Day 1: Strength, Day 2: Rest, Day 3: Strength, Day 4: Rest, Day 5: Speed, Day 6: Rest, Day 7: Rest
    days.push(strengthDay(weekNum)); // Day 1
    days.push(createRestDay(weekNum, 2)); // Day 2
    days.push(strengthDay(weekNum)); // Day 3
    days.push(createRestDay(weekNum, 4)); // Day 4
    days.push(speedDay(weekNum)); // Day 5
    days.push(createRestDay(weekNum, 6)); // Day 6
    days.push(createRestDay(weekNum, 7)); // Day 7
  } else if (weekNum <= 6) {
    // Weeks 3-6: 5 workouts, 2 rest days
    // Day 1: Strength, Day 2: Speed, Day 3: Strength, Day 4: Rest, Day 5: Speed, Day 6: Coordination, Day 7: Rest
    days.push(strengthDay(weekNum)); // Day 1
    days.push(speedDay(weekNum)); // Day 2
    days.push(strengthDay(weekNum)); // Day 3
    days.push(createRestDay(weekNum, 4)); // Day 4
    days.push(speedDay(weekNum)); // Day 5
    days.push(coordinationDay(weekNum)); // Day 6
    days.push(createRestDay(weekNum, 7)); // Day 7
  } else if (weekNum <= 10) {
    // Weeks 7-10: 7 workouts (daily), alternating Daily Driver and Coordination
    days.push(dailyDriverWorkout(weekNum)); // Day 1
    days.push(alternateDayWorkout(weekNum)); // Day 2
    days.push(dailyDriverWorkout(weekNum)); // Day 3
    days.push(dailyDriverWorkout(weekNum)); // Day 4
    days.push(alternateDayWorkout(weekNum)); // Day 5
    days.push(dailyDriverWorkout(weekNum)); // Day 6
    days.push(dailyDriverWorkout(weekNum)); // Day 7
  } else {
    // Weeks 11-12: 5 workouts, 2 rest days (maintenance)
    days.push(dailyDriverWorkout(weekNum)); // Day 1
    days.push(alternateDayWorkout(weekNum)); // Day 2
    days.push(dailyDriverWorkout(weekNum)); // Day 3
    days.push(createRestDay(weekNum, 4)); // Day 4
    days.push(dailyDriverWorkout(weekNum)); // Day 5
    days.push(dailyDriverWorkout(weekNum)); // Day 6
    days.push(createRestDay(weekNum, 7)); // Day 7
  }

  return {
    weekNumber: weekNum,
    phase,
    phaseDescription,
    days,
  };
};

export const workoutProgram: WorkoutProgram = {
  name: "PulseKegel 12-Week Program",
  weeks: Array.from({ length: 12 }, (_, i) => generateWeek(i + 1)),
};

export const getScheduledDaysForWeek = (weekNumber: number): number => {
  const week = workoutProgram.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) return 0;
  return week.days.filter((d) => !d.isRestDay).length;
};

export const getWorkoutCompletionsForWeek = (
  completedDates: string[],
  weekNumber: number,
  programStartDate: string,
): number => {
  const week = workoutProgram.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week || !programStartDate) return 0;

  const startParts = programStartDate.split("-").map(Number);
  const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

  const toDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  };

  const workoutDates = new Set<string>();
  week.days.forEach((day, idx) => {
    if (!day.isRestDay) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + idx);
      workoutDates.add(toDateStr(d));
    }
  });

  return completedDates.filter((date) => workoutDates.has(date)).length;
};

export const getTodaysWorkout = (
  completedDates: string[],
  startDate?: string,
): {
  week: Week;
  dayIndex: number;
  workout: DayTemplate;
  isRestDay: boolean;
} | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let start: Date;
  if (startDate) {
    start = new Date(startDate);
  } else {
    start = new Date(today);
  }
  start.setHours(0, 0, 0, 0);

  const daysSinceStart = Math.floor(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Each week is exactly 7 days, total program is 12 weeks = 84 days
  const totalProgramDays = 12 * 7; // 84 days
  const dayInProgram = daysSinceStart % totalProgramDays;

  // Calculate which week (0-indexed) and which day within the week (0-indexed)
  const weekIndex = Math.floor(dayInProgram / 7);
  const dayIndex = dayInProgram % 7;

  const week = workoutProgram.weeks[weekIndex];
  const workout = week.days[dayIndex];

  return {
    week,
    dayIndex,
    workout,
    isRestDay: workout.isRestDay === true,
  };
};

export const isRestDayForDate = (date: Date, startDate: string): boolean => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const daysSinceStart = Math.floor(
    (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceStart < 0) return false;

  const totalProgramDays = 12 * 7;
  const dayInProgram = daysSinceStart % totalProgramDays;
  const weekIndex = Math.floor(dayInProgram / 7);
  const dayIndex = dayInProgram % 7;

  const week = workoutProgram.weeks[weekIndex];
  if (!week) return false;
  const workout = week.days[dayIndex];
  return workout?.isRestDay === true;
};

export const getTotalProgramDays = (): number => {
  // Each week is 7 days, 12 weeks total
  return 12 * 7; // 84 days
};

export const getWorkoutForRecoveryMode = (
  workout: DayTemplate,
): DayTemplate => {
  return {
    ...workout,
    segments: [
      ...workout.segments.map((segment) => {
        if (segment.type === "blockRest") {
          return {
            ...segment,
            restSeconds: segment.restSeconds + 5,
          };
        }
        return {
          ...segment,
          sets: Math.max(1, Math.floor(segment.sets * 0.5)),
          repsPerSet: Math.max(1, Math.ceil(segment.repsPerSet * 0.7)),
          squeezeSeconds: Math.max(
            2,
            Math.floor(segment.squeezeSeconds * 0.75),
          ),
          restSeconds: segment.restSeconds + 2,
        };
      }),
      createSegment(
        "recovery-breathing",
        "Relaxation",
        "Deep breathing and full relaxation",
        1,
        5,
        3,
        5,
        "breathing",
      ),
    ],
    estimatedMinutes: Math.ceil(workout.estimatedMinutes * 0.6) + 2,
  };
};
