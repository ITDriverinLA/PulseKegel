import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Pressable, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  useSharedValue,
  FadeIn,
  ZoomIn,
  interpolateColor,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { PowerBar } from '@/components/PowerBar';
import { FormTipsSheet } from '@/components/FormTipsSheet';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { DayTemplate, Segment } from '@/data/workoutProgram';
import { WorkoutEngine, WorkoutState, WorkoutPhase } from '@/lib/workoutEngine';
import { hapticsManager, HapticPulseController } from '@/lib/hapticsManager';
import { storage, UserSettings, defaultSettings } from '@/lib/storage';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type RouteProps = RouteProp<RootStackParamList, 'WorkoutPlayer'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NEON_GREEN = '#00FF88';
const NEON_CYAN = '#00FFFF';
const NEON_PINK = '#FF3366';
const NEON_PURPLE = '#9D4EDD';

export default function WorkoutPlayerScreen() {
  // Keep screen awake during workout
  useKeepAwake();
  
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { workout, weekNumber, phase } = route.params;

  const [workoutState, setWorkoutState] = useState<WorkoutState | null>(null);
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [currentPhase, setCurrentPhase] = useState<WorkoutPhase>('squeeze');
  const [setInfo, setSetInfo] = useState({ current: 1, total: 1 });
  const [repInfo, setRepInfo] = useState({ current: 1, total: 1 });
  const [progress, setProgress] = useState({ current: 0, total: 1 });
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [showTips, setShowTips] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [phaseDuration, setPhaseDuration] = useState(3);

  const engineRef = useRef<WorkoutEngine | null>(null);
  const hapticPulseRef = useRef<HapticPulseController>(new HapticPulseController());
  const appStateRef = useRef(AppState.currentState);
  const startTimeRef = useRef<Date | null>(null);

  const phaseScale = useSharedValue(1);
  const phaseOpacity = useSharedValue(1);
  const glowPulse = useSharedValue(0);
  const backgroundPulse = useSharedValue(0);
  const phaseColorValue = useSharedValue(0);

  const loadSettings = useCallback(async () => {
    const userSettings = await storage.getSettings();
    setSettings(userSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
    backgroundPulse.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      true
    );
  }, [glowPulse, backgroundPulse]);

  useEffect(() => {
    return () => {
      hapticPulseRef.current.stop();
    };
  }, []);

  useEffect(() => {
    startTimeRef.current = new Date();
    
    const workoutSettings = {
      restDuration: settings.restDuration,
      blockRestDuration: settings.blockRestDuration,
      cooldownEnabled: settings.cooldownEnabled,
    };
    
    const engine = new WorkoutEngine(workout, {
      onStateChange: (state) => {
        setWorkoutState(state);
        if (engine) {
          setProgress(engine.getProgress());
        }
      },
      onPhaseChange: async (newPhase, segment) => {
        setCurrentPhase(newPhase);
        
        phaseColorValue.value = withTiming(newPhase === 'squeeze' ? 1 : 0, { duration: 300 });
        
        const duration = newPhase === 'squeeze' 
          ? segment.squeezeSeconds 
          : segment.restSeconds;
        setPhaseDuration(duration);
        
        phaseScale.value = 0.8;
        phaseOpacity.value = 0.5;
        phaseScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        phaseOpacity.value = withTiming(1, { duration: 200 });
        
        if (newPhase === 'squeeze') {
          hapticPulseRef.current.start(segment.type, settings, segment.squeezeSeconds, segment.rampSteps);
        } else {
          hapticPulseRef.current.triggerTransitionCue();
          hapticPulseRef.current.stop();
        }
      },
      onSegmentChange: (segment) => {
        setCurrentSegment(segment);
        setPhaseDuration(segment.squeezeSeconds);
        
        if (hapticPulseRef.current.isActive()) {
          hapticPulseRef.current.updateSegmentType(segment.type, segment.squeezeSeconds, segment.rampSteps);
        }
      },
      onSetChange: (current, total) => {
        setSetInfo({ current, total });
      },
      onRepChange: (current, total) => {
        setRepInfo({ current, total });
      },
      onComplete: async (seconds) => {
        hapticPulseRef.current.stop();
        setTotalSeconds(seconds);
        setIsComplete(true);
        await hapticsManager.triggerComplete(settings);
        
        const today = new Date().toISOString().split('T')[0];
        const minutes = Math.ceil(seconds / 60);
        await storage.addCompletedDate(today, minutes);
        
        const startDate = await storage.getProgramStartDate();
        if (!startDate) {
          await storage.setProgramStartDate(today);
        }
      },
      onTick: () => {},
    }, workoutSettings);

    engineRef.current = engine;
    setCurrentSegment(engine.getCurrentSegment());
    
    const firstSegment = engine.getCurrentSegment();
    if (firstSegment) {
      setPhaseDuration(firstSegment.squeezeSeconds);
    }
    
    engine.start();

    return () => {
      hapticPulseRef.current.stop();
      engine.destroy();
    };
  }, [workout, settings, phaseScale, phaseOpacity, phaseColorValue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        engineRef.current?.handleAppForeground();
        
        if (currentPhase === 'squeeze' && currentSegment && workoutState?.isRunning && !workoutState?.isPaused) {
          hapticPulseRef.current.start(currentSegment.type, settings, currentSegment.squeezeSeconds, currentSegment.rampSteps);
        }
      } else if (nextAppState.match(/inactive|background/)) {
        hapticPulseRef.current.stop();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentPhase, currentSegment, settings, workoutState?.isRunning, workoutState?.isPaused]);

  const handlePauseResume = async () => {
    if (!engineRef.current || !workoutState) return;
    
    await hapticsManager.triggerSelection();
    
    if (workoutState.isPaused) {
      engineRef.current.resume();
      if (currentPhase === 'squeeze' && currentSegment) {
        hapticPulseRef.current.start(currentSegment.type, settings, currentSegment.squeezeSeconds, currentSegment.rampSteps);
      }
    } else {
      engineRef.current.pause();
      hapticPulseRef.current.stop();
    }
  };

  const handleSkip = async () => {
    if (!engineRef.current) return;
    await hapticsManager.triggerSelection();
    hapticPulseRef.current.stop();
    engineRef.current.skipSegment();
  };

  const handleEnd = async () => {
    if (!engineRef.current) return;
    await hapticsManager.triggerWarning();
    hapticPulseRef.current.stop();
    engineRef.current.end();
  };

  const handleClose = () => {
    hapticPulseRef.current.stop();
    navigation.goBack();
  };

  const phaseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: phaseScale.value }],
    opacity: phaseOpacity.value,
  }));

  const phaseLabelStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      phaseColorValue.value,
      [0, 1],
      [NEON_CYAN, NEON_GREEN]
    );
    return {
      color,
      textShadowColor: color,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 20,
    };
  });

  const countdownStyle = useAnimatedStyle(() => {
    const glowIntensity = 0.5 + glowPulse.value * 0.5;
    const color = interpolateColor(
      phaseColorValue.value,
      [0, 1],
      [NEON_CYAN, NEON_GREEN]
    );
    return {
      color,
      textShadowColor: color,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 30 * glowIntensity,
    };
  });

  const ringProgress =
    progress.total > 0 ? progress.current / progress.total : 0;

  const getPhaseLabel = () => {
    if (currentSegment?.type === 'getReady') {
      return `STARTING IN ${workoutState?.secondsRemaining || 5}`;
    }
    if (currentSegment?.type === 'blockRest') return 'BREATHE';
    if (currentPhase === 'squeeze') {
      return currentSegment?.type === 'reverse' ? 'GENTLE PUSH' : 'SQUEEZE';
    }
    return 'REST';
  };

  const getPhaseLabelColor = () => {
    if (currentSegment?.type === 'getReady') return NEON_CYAN;
    if (currentSegment?.type === 'blockRest') return NEON_PURPLE;
    return currentPhase === 'squeeze' ? NEON_GREEN : NEON_CYAN;
  };

  if (isComplete) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + Spacing['3xl'],
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <ThemedText type="h4" style={{ color: '#fff' }}>Complete</ThemedText>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.completeContent}>
            <Animated.View
              entering={ZoomIn.duration(400)}
              style={[styles.completeIcon, { backgroundColor: `${NEON_GREEN}20` }]}
            >
              <Feather name="check-circle" size={80} color={NEON_GREEN} />
            </Animated.View>

            <Animated.View entering={FadeIn.delay(200)}>
              <ThemedText type="h1" style={[styles.completeTitle, { color: '#fff' }]}>
                Great Job!
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.completeSubtitle, { color: 'rgba(255,255,255,0.6)' }]}
              >
                You completed today's workout
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(400)} style={styles.completeStats}>
              <View style={[styles.completeStat, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}>
                <Feather name="clock" size={24} color={NEON_CYAN} />
                <ThemedText type="h3" style={{ marginTop: Spacing.sm, color: '#fff' }}>
                  {Math.ceil(totalSeconds / 60)}
                </ThemedText>
                <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Minutes
                </ThemedText>
              </View>
              
              <View style={[styles.completeStat, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}>
                <Feather name="target" size={24} color={NEON_PINK} />
                <ThemedText type="h3" style={{ marginTop: Spacing.sm, color: '#fff' }}>
                  {workout.segments.reduce((acc, s) => acc + s.sets * s.repsPerSet, 0)}
                </ThemedText>
                <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Reps
                </ThemedText>
              </View>
            </Animated.View>
          </View>

          <Pressable
            onPress={handleClose}
            style={[styles.doneButton, { backgroundColor: NEON_GREEN }]}
          >
            <ThemedText type="body" style={{ color: '#000', fontWeight: '700' }}>
              Done
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <Feather name="x" size={24} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Week {weekNumber} - {phase}
          </ThemedText>
          <Pressable onPress={() => setShowTips(true)} style={styles.headerButton}>
            <Feather name="help-circle" size={24} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        <View style={styles.mainContent}>
          <Animated.View style={phaseAnimatedStyle}>
            <Animated.Text
              style={[
                styles.phaseLabel,
                currentSegment?.type === 'getReady'
                  ? { color: NEON_CYAN, textShadowColor: NEON_CYAN, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20, fontSize: 36 }
                  : currentSegment?.type === 'blockRest' 
                    ? { color: NEON_PURPLE, textShadowColor: NEON_PURPLE, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }
                    : phaseLabelStyle,
              ]}
            >
              {getPhaseLabel()}
            </Animated.Text>
          </Animated.View>

          <View style={styles.powerBarContainer}>
            <PowerBar
              phase={currentPhase}
              segmentType={currentSegment?.type || 'slowHolds'}
              durationSeconds={phaseDuration}
              isActive={Boolean(workoutState?.isRunning && !workoutState?.isPaused && currentSegment?.type !== 'getReady')}
              height={300}
              width={120}
              rampSteps={currentSegment?.rampSteps}
            />
            {currentSegment?.type !== 'getReady' ? (
              <View style={styles.countdownContainer}>
                <Animated.Text style={[styles.countdown, countdownStyle]}>
                  {workoutState?.secondsRemaining || 0}
                </Animated.Text>
                <ThemedText type="small" style={styles.countdownLabel}>
                  {(workoutState?.secondsRemaining || 0) === 1 ? 'second' : 'seconds'}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.segmentInfo}>
            <ThemedText type="h4" style={[styles.segmentName, { color: '#fff' }]}>
              {currentSegment?.type === 'getReady' ? 'Get Ready' : currentSegment?.name || ''}
            </ThemedText>
            {currentSegment?.type !== 'getReady' ? (
              <ThemedText
                type="body"
                style={[styles.segmentDetail, { color: 'rgba(255,255,255,0.5)' }]}
              >
                Set {setInfo.current} of {setInfo.total} • Rep {repInfo.current} of{' '}
                {repInfo.total}
              </ThemedText>
            ) : (
              <ThemedText
                type="body"
                style={[styles.segmentDetail, { color: 'rgba(255,255,255,0.5)' }]}
              >
                Prepare for your workout
              </ThemedText>
            )}
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={[NEON_GREEN, NEON_CYAN]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${ringProgress * 100}%` }]}
              />
            </View>
            <ThemedText type="small" style={styles.progressText}>
              {Math.round(ringProgress * 100)}%
            </ThemedText>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={handlePauseResume}
            style={styles.mainButton}
          >
            <LinearGradient
              colors={[NEON_GREEN, '#00CC66']}
              style={styles.mainButtonGradient}
            >
              <Feather
                name={workoutState?.isPaused ? 'play' : 'pause'}
                size={32}
                color="#000"
              />
            </LinearGradient>
          </Pressable>

          <View style={styles.secondaryControls}>
            <Pressable
              onPress={handleSkip}
              style={styles.secondaryButton}
            >
              <Feather name="skip-forward" size={20} color="rgba(255,255,255,0.8)" />
              <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: 'rgba(255,255,255,0.8)' }}>
                Skip
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleEnd}>
              <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.4)' }}>
                End Workout
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>

      <FormTipsSheet visible={showTips} onClose={() => setShowTips(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  powerBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
    gap: Spacing['3xl'],
  },
  countdownContainer: {
    alignItems: 'center',
    width: 120,
  },
  countdown: {
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: -2,
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.4)',
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  segmentInfo: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  segmentName: {
    marginBottom: Spacing.xs,
  },
  segmentDetail: {
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    color: 'rgba(255,255,255,0.5)',
    width: 40,
    textAlign: 'right',
  },
  controls: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  mainButton: {
    marginBottom: Spacing.xl,
    borderRadius: 40,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  mainButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2xl'],
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['3xl'],
  },
  completeTitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  completeSubtitle: {
    textAlign: 'center',
    marginBottom: Spacing['3xl'],
  },
  completeStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  completeStat: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: BorderRadius.lg,
  },
  doneButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
