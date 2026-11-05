import {
  WorkoutEngine,
  defaultWorkoutSettings,
  phaseCountdownSeconds,
  SET_REST_SECONDS,
} from "../workoutEngine";
import {
  getFirstSessionPlannedSteps,
  getFirstSessionWorkout,
} from "@/data/workoutProgram";

function silentCallbacks() {
  return {
    onStateChange: jest.fn(),
    onPhaseChange: jest.fn(),
    onSegmentChange: jest.fn(),
    onSetChange: jest.fn(),
    onRepChange: jest.fn(),
    onComplete: jest.fn(),
    onTick: jest.fn(),
  };
}

describe("F1 WorkoutEngine resume seek", () => {
  it("starts at the requested safe segment index", () => {
    const workout = getFirstSessionWorkout();
    const engine = new WorkoutEngine(workout, silentCallbacks(), undefined, 1);
    expect(engine.getState().segmentIndex).toBe(1);
    engine.start();
    expect(engine.getCurrentSegment()?.type).toBe("slowHolds");
    engine.end();
  });

  it("clamps an out-of-range resume index to the last safe step", () => {
    const workout = getFirstSessionWorkout();
    const engine = new WorkoutEngine(workout, silentCallbacks(), undefined, 99);
    expect(engine.getState().segmentIndex).toBe(workout.segments.length - 1);
    engine.end();
  });

  it("seekToSegment updates before start", () => {
    const workout = getFirstSessionWorkout();
    const engine = new WorkoutEngine(workout, silentCallbacks());
    engine.seekToSegment(2);
    expect(engine.getState().segmentIndex).toBe(2);
    engine.start();
    expect(engine.getCurrentSegment()?.type).toBe("breathing");
    engine.end();
  });

  it("keeps first-session cool-down even when cooldownEnabled is false", () => {
    const workout = getFirstSessionWorkout();
    const planned = getFirstSessionPlannedSteps(workout);
    expect(planned).toBe(3);

    const engine = new WorkoutEngine(
      workout,
      silentCallbacks(),
      { ...defaultWorkoutSettings, cooldownEnabled: false },
      2,
    );
    // If cool-down were filtered, index 2 would clamp to 1 (slow holds).
    expect(engine.getState().segmentIndex).toBe(2);
    engine.start();
    expect(engine.getCurrentSegment()?.id).toBe("fs-short-cooldown");
    engine.end();
  });

  it("still drops cool-down on non-first-session workouts when disabled", () => {
    const workout = getFirstSessionWorkout();
    const nonFirst = { ...workout, id: "w1-d2-strength" };

    const withCooldown = new WorkoutEngine(
      nonFirst,
      silentCallbacks(),
      { ...defaultWorkoutSettings, cooldownEnabled: true },
      2,
    );
    expect(withCooldown.getState().segmentIndex).toBe(2);
    withCooldown.start();
    expect(withCooldown.getCurrentSegment()?.id).toBe("fs-short-cooldown");
    withCooldown.end();

    const withoutCooldown = new WorkoutEngine(
      nonFirst,
      silentCallbacks(),
      { ...defaultWorkoutSettings, cooldownEnabled: false },
      2,
    );
    // Cool-down dropped → only 2 segments → resume index 2 clamps to 1.
    expect(withoutCooldown.getState().segmentIndex).toBe(1);
    withoutCooldown.start();
    expect(withoutCooldown.getCurrentSegment()?.id).not.toBe(
      "fs-short-cooldown",
    );
    withoutCooldown.end();
  });
});

describe("P7c foreground resume rest source", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the new rep-rest default at 3s and set rest at 10s", () => {
    expect(defaultWorkoutSettings.restDuration).toBe(3);
    expect(defaultWorkoutSettings.blockRestDuration).toBe(25);
    expect(SET_REST_SECONDS).toBe(10);
    expect(
      phaseCountdownSeconds(
        "rest",
        { squeezeSeconds: 5 },
        { restDuration: 3 },
        false,
      ),
    ).toBe(3);
    expect(
      phaseCountdownSeconds(
        "rest",
        { squeezeSeconds: 5 },
        { restDuration: 3 },
        true,
      ),
    ).toBe(10);
  });

  it("recomputes rep rest from settings.restDuration, not segment.restSeconds", () => {
    jest.useFakeTimers();
    const workout = getFirstSessionWorkout();
    const segments = workout.segments.map((segment) =>
      segment.type === "slowHolds"
        ? { ...segment, squeezeSeconds: 1, restSeconds: 8 }
        : segment,
    );
    const engine = new WorkoutEngine(
      { ...workout, segments },
      silentCallbacks(),
      { restDuration: 3, blockRestDuration: 25, cooldownEnabled: true },
      1,
    );
    engine.start();
    expect(engine.getState().secondsRemaining).toBe(1);
    jest.advanceTimersByTime(1000);
    expect(engine.getState().phase).toBe("rest");
    expect(engine.getState().isSetRest).toBe(false);
    expect(engine.getState().secondsRemaining).toBe(3);
    engine.handleAppForeground();
    expect(engine.getState().secondsRemaining).toBe(3);
    engine.end();
  });

  it("keeps set rest at 10s on foreground", () => {
    jest.useFakeTimers();
    const workout = getFirstSessionWorkout();
    const segment = {
      ...workout.segments[1],
      sets: 2,
      repsPerSet: 1,
      squeezeSeconds: 1,
      restSeconds: 8,
    };
    const engine = new WorkoutEngine(
      { ...workout, id: "set-rest-check", segments: [segment] },
      silentCallbacks(),
      { restDuration: 3, blockRestDuration: 25, cooldownEnabled: true },
    );
    engine.start();
    jest.advanceTimersByTime(4000);
    expect(engine.getState().isSetRest).toBe(true);
    expect(engine.getState().phase).toBe("rest");
    expect(engine.getState().secondsRemaining).toBe(10);
    engine.handleAppForeground();
    expect(engine.getState().secondsRemaining).toBe(10);
    engine.end();
  });
});
