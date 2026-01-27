import { DayTemplate, Segment } from '@/data/workoutProgram';

export type WorkoutPhase = 'squeeze' | 'rest';

export interface WorkoutSettings {
  restDuration: number;
  cooldownEnabled: boolean;
}

export const defaultWorkoutSettings: WorkoutSettings = {
  restDuration: 5,
  cooldownEnabled: true,
};

export interface WorkoutState {
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  segmentIndex: number;
  setIndex: number;
  repIndex: number;
  phase: WorkoutPhase;
  secondsRemaining: number;
  totalElapsedSeconds: number;
  phaseStartTime: number | null;
  pauseStartTime: number | null;
  totalPausedTime: number;
  isSetRest: boolean;
}

const SET_REST_SECONDS = 10;

export interface WorkoutEngineCallbacks {
  onStateChange: (state: WorkoutState) => void;
  onPhaseChange: (phase: WorkoutPhase, segment: Segment) => void;
  onSegmentChange: (segment: Segment, segmentIndex: number) => void;
  onSetChange: (setIndex: number, totalSets: number) => void;
  onRepChange: (repIndex: number, totalReps: number) => void;
  onComplete: (totalSeconds: number) => void;
  onTick: (secondsRemaining: number) => void;
}

export class WorkoutEngine {
  private workout: DayTemplate;
  private state: WorkoutState;
  private callbacks: WorkoutEngineCallbacks;
  private tickInterval: NodeJS.Timeout | null = null;
  private segments: Segment[];
  private settings: WorkoutSettings;

  constructor(workout: DayTemplate, callbacks: WorkoutEngineCallbacks, settings?: WorkoutSettings) {
    this.workout = workout;
    this.callbacks = callbacks;
    this.settings = settings || defaultWorkoutSettings;
    
    // Filter out cooldown segment if disabled (cooldown segments have 'cooldown' in their ID)
    let filteredSegments = workout.segments;
    if (!this.settings.cooldownEnabled) {
      filteredSegments = workout.segments.filter(s => !s.id.includes('cooldown'));
    }
    this.segments = filteredSegments;
    
    this.state = {
      isRunning: false,
      isPaused: false,
      isComplete: false,
      segmentIndex: 0,
      setIndex: 0,
      repIndex: 0,
      phase: 'squeeze',
      secondsRemaining: this.segments[0]?.squeezeSeconds || 0,
      totalElapsedSeconds: 0,
      phaseStartTime: null,
      pauseStartTime: null,
      totalPausedTime: 0,
      isSetRest: false,
    };
  }

  getCurrentSegment(): Segment | null {
    return this.segments[this.state.segmentIndex] || null;
  }

  getState(): WorkoutState {
    return { ...this.state };
  }

  getProgress(): { current: number; total: number } {
    let totalReps = 0;
    let completedReps = 0;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      const segmentReps = segment.sets * segment.repsPerSet;
      totalReps += segmentReps;

      if (i < this.state.segmentIndex) {
        completedReps += segmentReps;
      } else if (i === this.state.segmentIndex) {
        completedReps +=
          this.state.setIndex * segment.repsPerSet + this.state.repIndex;
        if (this.state.phase === 'rest') {
          completedReps += 0.5;
        }
      }
    }

    return { current: completedReps, total: totalReps };
  }

  start(): void {
    if (this.state.isComplete) return;
    
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.phaseStartTime = Date.now();
    
    const segment = this.getCurrentSegment();
    if (segment) {
      this.callbacks.onSegmentChange(segment, this.state.segmentIndex);
      this.callbacks.onSetChange(this.state.setIndex + 1, segment.sets);
      this.callbacks.onRepChange(this.state.repIndex + 1, segment.repsPerSet);
      this.callbacks.onPhaseChange(this.state.phase, segment);
    }
    
    this.callbacks.onStateChange(this.getState());
    this.startTicking();
  }

  pause(): void {
    if (!this.state.isRunning || this.state.isPaused) return;
    
    this.state.isPaused = true;
    this.state.pauseStartTime = Date.now();
    this.stopTicking();
    this.callbacks.onStateChange(this.getState());
  }

  resume(): void {
    if (!this.state.isRunning || !this.state.isPaused) return;
    
    if (this.state.pauseStartTime) {
      this.state.totalPausedTime += Date.now() - this.state.pauseStartTime;
    }
    
    this.state.isPaused = false;
    this.state.pauseStartTime = null;
    this.callbacks.onStateChange(this.getState());
    this.startTicking();
  }

  skipSegment(): void {
    if (!this.state.isRunning || this.state.isComplete) return;
    
    this.advanceToNextSegment();
  }

  end(): void {
    this.stopTicking();
    this.state.isRunning = false;
    this.state.isComplete = true;
    this.callbacks.onComplete(this.state.totalElapsedSeconds);
    this.callbacks.onStateChange(this.getState());
  }

  handleAppForeground(): void {
    if (!this.state.isRunning || this.state.isPaused || !this.state.phaseStartTime) {
      return;
    }

    const now = Date.now();
    const elapsedSincePhaseStart = (now - this.state.phaseStartTime - this.state.totalPausedTime) / 1000;
    const segment = this.getCurrentSegment();
    
    if (!segment) return;

    const phaseDuration =
      this.state.phase === 'squeeze'
        ? segment.squeezeSeconds
        : segment.restSeconds;

    if (elapsedSincePhaseStart >= phaseDuration) {
      const overflow = elapsedSincePhaseStart - phaseDuration;
      this.advancePhase();
      
      if (overflow > 0 && !this.state.isComplete) {
        this.state.secondsRemaining = Math.max(
          0,
          this.state.secondsRemaining - Math.floor(overflow)
        );
      }
    } else {
      this.state.secondsRemaining = Math.ceil(phaseDuration - elapsedSincePhaseStart);
    }

    this.callbacks.onStateChange(this.getState());
  }

  private startTicking(): void {
    this.stopTicking();
    
    this.tickInterval = setInterval(() => {
      if (this.state.isPaused || !this.state.isRunning) return;
      
      this.state.secondsRemaining--;
      this.state.totalElapsedSeconds++;
      
      this.callbacks.onTick(this.state.secondsRemaining);
      
      if (this.state.secondsRemaining <= 0) {
        this.advancePhase();
      }
      
      this.callbacks.onStateChange(this.getState());
    }, 1000);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private advancePhase(): void {
    const segment = this.getCurrentSegment();
    if (!segment) {
      this.end();
      return;
    }

    if (this.state.phase === 'squeeze') {
      // Check if this is the last rep of the last set - skip rest if next is block rest or cooldown
      const isLastRep = this.state.repIndex === segment.repsPerSet - 1;
      const isLastSet = this.state.setIndex === segment.sets - 1;
      const nextSegment = this.segments[this.state.segmentIndex + 1];
      const nextIsBlockRestOrEnd = !nextSegment || nextSegment.type === 'blockRest' || nextSegment.id.includes('cooldown');
      
      if (isLastRep && isLastSet && nextIsBlockRestOrEnd) {
        // Skip rest and go directly to next segment
        this.advanceRep();
      } else {
        // Normal rest between reps - use custom rest duration
        this.state.phase = 'rest';
        this.state.secondsRemaining = this.settings.restDuration;
        this.state.phaseStartTime = Date.now();
        this.callbacks.onPhaseChange('rest', segment);
      }
    } else if (this.state.isSetRest) {
      this.state.isSetRest = false;
      this.state.phase = 'squeeze';
      this.state.secondsRemaining = segment.squeezeSeconds;
      this.state.phaseStartTime = Date.now();
      this.callbacks.onRepChange(1, segment.repsPerSet);
      this.callbacks.onPhaseChange('squeeze', segment);
    } else {
      this.advanceRep();
    }
  }

  private advanceRep(): void {
    const segment = this.getCurrentSegment();
    if (!segment) {
      this.end();
      return;
    }

    this.state.repIndex++;

    if (this.state.repIndex >= segment.repsPerSet) {
      this.advanceSet();
      return;
    }

    this.state.phase = 'squeeze';
    this.state.secondsRemaining = segment.squeezeSeconds;
    this.state.phaseStartTime = Date.now();
    this.callbacks.onRepChange(this.state.repIndex + 1, segment.repsPerSet);
    this.callbacks.onPhaseChange('squeeze', segment);
  }

  private advanceSet(): void {
    const segment = this.getCurrentSegment();
    if (!segment) {
      this.end();
      return;
    }

    this.state.setIndex++;
    this.state.repIndex = 0;

    if (this.state.setIndex >= segment.sets) {
      this.advanceToNextSegment();
      return;
    }

    this.state.isSetRest = true;
    this.state.phase = 'rest';
    this.state.secondsRemaining = SET_REST_SECONDS;
    this.state.phaseStartTime = Date.now();
    this.callbacks.onSetChange(this.state.setIndex + 1, segment.sets);
    this.callbacks.onPhaseChange('rest', segment);
  }

  private advanceToNextSegment(): void {
    this.state.segmentIndex++;
    this.state.setIndex = 0;
    this.state.repIndex = 0;

    if (this.state.segmentIndex >= this.segments.length) {
      this.end();
      return;
    }

    const newSegment = this.getCurrentSegment();
    if (!newSegment) {
      this.end();
      return;
    }

    this.state.phase = 'squeeze';
    this.state.secondsRemaining = newSegment.squeezeSeconds;
    this.state.phaseStartTime = Date.now();
    
    this.callbacks.onSegmentChange(newSegment, this.state.segmentIndex);
    this.callbacks.onSetChange(1, newSegment.sets);
    this.callbacks.onRepChange(1, newSegment.repsPerSet);
    this.callbacks.onPhaseChange('squeeze', newSegment);
  }

  destroy(): void {
    this.stopTicking();
  }
}
