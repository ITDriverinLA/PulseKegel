import { WorkoutEngine } from "../workoutEngine";
import { getFirstSessionWorkout } from "@/data/workoutProgram";

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
});
