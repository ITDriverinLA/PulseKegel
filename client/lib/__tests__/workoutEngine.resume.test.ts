import { WorkoutEngine, defaultWorkoutSettings } from "../workoutEngine";
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
    expect(withoutCooldown.getCurrentSegment()?.id).not.toBe("fs-short-cooldown");
    withoutCooldown.end();
  });
});
