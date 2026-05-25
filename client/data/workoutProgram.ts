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
        20,
        0,
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
        20,
        0,
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
        20,
        0,
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

  if (weekNum === 1) {
    // Week 1 (7-Day Challenge): Day 7 is a strength finale — never a rest day.
    // Day 1: Strength (calibration), Day 2: Rest, Day 3: Strength, Day 4: Rest,
    // Day 5: Speed, Day 6: Rest, Day 7: Strength finale.
    days.push(strengthDay(weekNum)); // Day 1
    days.push(createRestDay(weekNum, 2)); // Day 2
    days.push(strengthDay(weekNum)); // Day 3
    days.push(createRestDay(weekNum, 4)); // Day 4
    days.push(speedDay(weekNum)); // Day 5
    days.push(createRestDay(weekNum, 6)); // Day 6
    days.push(strengthDay(weekNum)); // Day 7 - finale before challenge results
  } else if (weekNum <= 2) {
    // Week 2: 3 workouts, 4 rest days (Mon/Wed/Fri pattern)
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
    const [sy, sm, sd] = startDate.split("-").map(Number);
    start = new Date(sy, sm - 1, sd); // local midnight — avoids UTC-parse shift
  } else {
    start = new Date(today);
  }

  // Use Date.UTC with local date parts so DST transitions (23-hour days) do
  // not cause an off-by-one in the day count.
  const daysSinceStart = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86400000,
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
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd); // local midnight — avoids UTC-parse shift
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  // Use Date.UTC with local date parts so DST transitions (23-hour days) do
  // not cause an off-by-one in the day count.
  const daysSinceStart = Math.round(
    (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86400000,
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

export type ChallengeCalibrationLevel = "easy" | "okay" | "tooHard" | null;
export type ChallengeDifficultyPath =
  | "accelerated"
  | "standard"
  | "gentle"
  | null;

const calibrationStrengthDay = (): DayTemplate => {
  const sets = 2;
  const reps = 6;
  const hold = 5;
  const rest = 5;
  const flickReps = 10;
  const reverseReps = 4;
  const totalSeconds =
    sets * reps * (hold + rest) +
    20 +
    flickReps * 2 +
    20 +
    reverseReps * 8 +
    20;
  return {
    id: "w1-calibration",
    name: "Calibration Day",
    dayType: "strength",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady("w1-cal-getready"),
      createSegment(
        "w1-cal-slow",
        "Slow Holds",
        "Squeeze and hold, then fully relax",
        sets,
        reps,
        hold,
        rest,
        "slowHolds",
      ),
      createBlockRest("w1-cal-rest1"),
      createSegment(
        "w1-cal-flicks",
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        1,
        flickReps,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest("w1-cal-rest2"),
      createSegment(
        "w1-cal-reverse",
        "Reverse Kegels",
        "Gently release and drop tension",
        1,
        reverseReps,
        4,
        4,
        "reverse",
      ),
      createSegment(
        "w1-cal-cooldown",
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        20,
        0,
        "breathing",
      ),
    ],
  };
};

const lightStrengthDay = (id: string): DayTemplate => {
  const sets = 2;
  const reps = 6;
  const hold = 5;
  const rest = 5;
  const flickReps = 10;
  const reverseReps = 4;
  const totalSeconds =
    sets * reps * (hold + rest) +
    20 +
    flickReps * 2 +
    20 +
    reverseReps * 8 +
    20;
  return {
    id,
    name: "Light Training",
    dayType: "strength",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady(`${id}-getready`),
      createSegment(
        `${id}-slow`,
        "Slow Holds",
        "Squeeze and hold, then fully relax",
        sets,
        reps,
        hold,
        rest,
        "slowHolds",
      ),
      createBlockRest(`${id}-rest1`),
      createSegment(
        `${id}-flicks`,
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        1,
        flickReps,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest(`${id}-rest2`),
      createSegment(
        `${id}-reverse`,
        "Reverse Kegels",
        "Gently release and drop tension",
        1,
        reverseReps,
        4,
        4,
        "reverse",
      ),
      createSegment(
        `${id}-cooldown`,
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        20,
        0,
        "breathing",
      ),
    ],
  };
};

const acceleratedStrengthDay = (): DayTemplate => {
  const sets = 3;
  const reps = 10;
  const hold = 5;
  const rest = 5;
  const flickReps = 12;
  const reverseReps = 4;
  const totalSeconds =
    sets * reps * (hold + rest) +
    20 +
    flickReps * 2 +
    20 +
    reverseReps * 8 +
    20;
  return {
    id: "w1-acc-d3",
    name: "Strength Training",
    dayType: "strength",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady("w1-acc-d3-getready"),
      createSegment(
        "w1-acc-d3-slow",
        "Slow Holds",
        "Squeeze and hold, then fully relax",
        sets,
        reps,
        hold,
        rest,
        "slowHolds",
      ),
      createBlockRest("w1-acc-d3-rest1"),
      createSegment(
        "w1-acc-d3-flicks",
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        1,
        flickReps,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest("w1-acc-d3-rest2"),
      createSegment(
        "w1-acc-d3-reverse",
        "Reverse Kegels",
        "Gently release and drop tension",
        1,
        reverseReps,
        4,
        4,
        "reverse",
      ),
      createSegment(
        "w1-acc-d3-cooldown",
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        20,
        0,
        "breathing",
      ),
    ],
  };
};

const gentleStrengthDay = (): DayTemplate => {
  const sets = 2;
  const reps = 5;
  const hold = 4;
  const rest = 5;
  const flickReps = 8;
  const reverseReps = 3;
  const totalSeconds =
    sets * reps * (hold + rest) +
    20 +
    flickReps * 2 +
    20 +
    reverseReps * 8 +
    20;
  return {
    id: "w1-gen-d3",
    name: "Strength Training",
    dayType: "strength",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady("w1-gen-d3-getready"),
      createSegment(
        "w1-gen-d3-slow",
        "Slow Holds",
        "Squeeze and hold, then fully relax",
        sets,
        reps,
        hold,
        rest,
        "slowHolds",
      ),
      createBlockRest("w1-gen-d3-rest1"),
      createSegment(
        "w1-gen-d3-flicks",
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        1,
        flickReps,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest("w1-gen-d3-rest2"),
      createSegment(
        "w1-gen-d3-reverse",
        "Reverse Kegels",
        "Gently release and drop tension",
        1,
        reverseReps,
        4,
        4,
        "reverse",
      ),
      createSegment(
        "w1-gen-d3-cooldown",
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        20,
        0,
        "breathing",
      ),
    ],
  };
};

const gentleSpeedDay = (): DayTemplate => {
  // Day 5 — building back toward standard speedDay(1) which uses 3×25 flicks,
  // 9 contract-relax, 5 slow holds. Gentle Day 5 ramps to 2×25 flicks,
  // 8 contract-relax, 5 slow holds — noticeable step up from gentle Day 3.
  const flickSets = 2;
  const flickReps = 25;
  const contractReps = 8;
  const slowReps = 5;
  const slowHold = 5;
  const totalSeconds =
    flickSets * flickReps * 2 +
    20 +
    contractReps * 6 +
    20 +
    slowReps * (slowHold + 4) +
    20;
  return {
    id: "w1-gen-d5",
    name: "Speed Training",
    dayType: "speed",
    estimatedMinutes: Math.ceil(totalSeconds / 60),
    segments: [
      createGetReady("w1-gen-d5-getready"),
      createSegment(
        "w1-gen-d5-flicks",
        "Quick Flicks",
        "Quick squeeze and release rhythm",
        flickSets,
        flickReps,
        1,
        1,
        "quickFlicks",
      ),
      createBlockRest("w1-gen-d5-rest1"),
      createSegment(
        "w1-gen-d5-contract",
        "Contract-Relax",
        "Short squeeze with longer relaxation",
        1,
        contractReps,
        2,
        4,
        "contractRelax",
      ),
      createBlockRest("w1-gen-d5-rest2"),
      createSegment(
        "w1-gen-d5-slow",
        "Slow Holds",
        "Squeeze and hold for control",
        1,
        slowReps,
        slowHold,
        4,
        "slowHolds",
      ),
      createSegment(
        "w1-gen-d5-cooldown",
        "Cool Down",
        "Relax and breathe deeply",
        1,
        1,
        20,
        0,
        "breathing",
      ),
    ],
  };
};

export const getWeek1WorkoutForDayIndex = (
  dayIndex: number,
  difficultyPath: ChallengeDifficultyPath,
): DayTemplate => {
  if (dayIndex === 0) {
    return calibrationStrengthDay();
  }

  if (difficultyPath === "accelerated") {
    switch (dayIndex) {
      case 1:
        return lightStrengthDay("w1-acc-d2");
      case 2:
        return acceleratedStrengthDay();
      case 3:
        return createRestDay(1, 4);
      case 4:
        return speedDay(1);
      case 5:
        return createRestDay(1, 6);
      case 6:
        return acceleratedStrengthDay();
      default:
        return workoutProgram.weeks[0].days[dayIndex];
    }
  }

  if (difficultyPath === "gentle") {
    switch (dayIndex) {
      case 1:
        return createRestDay(1, 2);
      case 2:
        return gentleStrengthDay();
      case 3:
        return createRestDay(1, 4);
      case 4:
        return gentleSpeedDay();
      case 5:
        return createRestDay(1, 6);
      case 6:
        return gentleStrengthDay();
      default:
        return workoutProgram.weeks[0].days[dayIndex];
    }
  }

  return workoutProgram.weeks[0].days[dayIndex];
};

export const getLastWorkoutDayIndexForWeek = (weekNumber: number): number => {
  const week = workoutProgram.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) return -1;
  for (let i = week.days.length - 1; i >= 0; i--) {
    if (!week.days[i].isRestDay) return i;
  }
  return -1;
};

export const getWorkoutForDifficultyPath = (
  workout: DayTemplate,
  path: ChallengeDifficultyPath,
): DayTemplate => {
  if (!path || path === "standard" || workout.isRestDay) return workout;

  const isAccelerated = path === "accelerated";
  const repMul = isAccelerated ? 1.2 : 0.7;
  const setMul = isAccelerated ? 1 : 0.75;
  const holdDelta = isAccelerated ? 1 : -1;
  const restDelta = isAccelerated ? 0 : 2;

  const adjusted = workout.segments.map((segment) => {
    if (
      segment.type === "blockRest" ||
      segment.type === "getReady" ||
      segment.type === "breathing"
    ) {
      return segment;
    }
    return {
      ...segment,
      sets: Math.max(1, Math.round(segment.sets * setMul)),
      repsPerSet: Math.max(1, Math.round(segment.repsPerSet * repMul)),
      squeezeSeconds: Math.max(
        1,
        segment.squeezeSeconds + (segment.squeezeSeconds > 0 ? holdDelta : 0),
      ),
      restSeconds: Math.max(1, segment.restSeconds + restDelta),
    };
  });

  return {
    ...workout,
    segments: adjusted,
    estimatedMinutes: Math.max(
      1,
      Math.ceil(workout.estimatedMinutes * (isAccelerated ? 1.2 : 0.75)),
    ),
  };
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
