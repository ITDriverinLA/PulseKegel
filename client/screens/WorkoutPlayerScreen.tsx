import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Pressable, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
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

export default function WorkoutPlayerScreen() {
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

  const loadSettings = useCallback(async () => {
    const userSettings = await storage.getSettings();
    setSettings(userSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    return () => {
      hapticPulseRef.current.stop();
    };
  }, []);

  useEffect(() => {
    startTimeRef.current = new Date();
    
    const engine = new WorkoutEngine(workout, {
      onStateChange: (state) => {
        setWorkoutState(state);
        if (engine) {
          setProgress(engine.getProgress());
        }
      },
      onPhaseChange: async (newPhase, segment) => {
        setCurrentPhase(newPhase);
        
        const duration = newPhase === 'squeeze' 
          ? segment.squeezeSeconds 
          : segment.restSeconds;
        setPhaseDuration(duration);
        
        phaseScale.value = 0.8;
        phaseOpacity.value = 0.5;
        phaseScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        phaseOpacity.value = withTiming(1, { duration: 200 });
        
        if (newPhase === 'squeeze') {
          hapticPulseRef.current.start(segment.type, settings);
        } else {
          hapticPulseRef.current.stop();
        }
      },
      onSegmentChange: (segment) => {
        setCurrentSegment(segment);
        setPhaseDuration(segment.squeezeSeconds);
        
        if (hapticPulseRef.current.isActive()) {
          hapticPulseRef.current.updateSegmentType(segment.type);
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
    });

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
  }, [workout, settings, phaseScale, phaseOpacity]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        engineRef.current?.handleAppForeground();
        
        if (currentPhase === 'squeeze' && currentSegment && workoutState?.isRunning && !workoutState?.isPaused) {
          hapticPulseRef.current.start(currentSegment.type, settings);
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
        hapticPulseRef.current.start(currentSegment.type, settings);
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

  const phaseColor = currentPhase === 'squeeze' ? theme.squeeze : theme.rest;
  const ringProgress =
    progress.total > 0 ? progress.current / progress.total : 0;

  if (isComplete) {
    return (
      <ThemedView style={styles.container}>
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
            <ThemedText type="h4">Complete</ThemedText>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.completeContent}>
            <Animated.View
              entering={ZoomIn.duration(400)}
              style={[styles.completeIcon, { backgroundColor: `${theme.success}20` }]}
            >
              <Feather name="check-circle" size={80} color={theme.success} />
            </Animated.View>

            <Animated.View entering={FadeIn.delay(200)}>
              <ThemedText type="h1" style={styles.completeTitle}>
                Great Job!
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.completeSubtitle, { color: theme.textSecondary }]}
              >
                You completed today's workout
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(400)} style={styles.completeStats}>
              <View style={[styles.completeStat, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="clock" size={24} color={theme.primary} />
                <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
                  {Math.ceil(totalSeconds / 60)}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Minutes
                </ThemedText>
              </View>
              
              <View style={[styles.completeStat, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="target" size={24} color={theme.primary} />
                <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
                  {workout.segments.reduce((acc, s) => acc + s.sets * s.repsPerSet, 0)}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Reps
                </ThemedText>
              </View>
            </Animated.View>
          </View>

          <Pressable
            onPress={handleClose}
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              Done
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
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
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Week {weekNumber} - {phase}
          </ThemedText>
          <Pressable onPress={() => setShowTips(true)} style={styles.headerButton}>
            <Feather name="help-circle" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.mainContent}>
          <Animated.View style={phaseAnimatedStyle}>
            <ThemedText
              style={[
                styles.phaseLabel,
                { color: currentSegment?.type === 'blockRest' ? theme.rest : phaseColor },
              ]}
            >
              {currentSegment?.type === 'blockRest' 
                ? 'BREATHE' 
                : currentPhase === 'squeeze' 
                  ? 'SQUEEZE' 
                  : 'REST'}
            </ThemedText>
          </Animated.View>

          <View style={styles.powerBarContainer}>
            <PowerBar
              phase={currentPhase}
              segmentType={currentSegment?.type || 'slowHolds'}
              durationSeconds={phaseDuration}
              isActive={workoutState?.isRunning && !workoutState?.isPaused}
              height={220}
              width={60}
            />
            <ThemedText style={[styles.countdown, { color: theme.text }]}>
              {workoutState?.secondsRemaining || 0}
            </ThemedText>
          </View>

          <View style={styles.segmentInfo}>
            <ThemedText type="h4" style={styles.segmentName}>
              {currentSegment?.name || ''}
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.segmentDetail, { color: theme.textSecondary }]}
            >
              Set {setInfo.current} of {setInfo.total} • Rep {repInfo.current} of{' '}
              {repInfo.total}
            </ThemedText>
          </View>

          <View style={[styles.progressBar, { backgroundColor: theme.backgroundDefault }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: theme.primary, width: `${ringProgress * 100}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={handlePauseResume}
            style={[styles.mainButton, { backgroundColor: theme.primary }]}
          >
            <Feather
              name={workoutState?.isPaused ? 'play' : 'pause'}
              size={32}
              color="#FFFFFF"
            />
          </Pressable>

          <View style={styles.secondaryControls}>
            <Pressable
              onPress={handleSkip}
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundDefault }]}
            >
              <Feather name="skip-forward" size={20} color={theme.text} />
              <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
                Skip
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleEnd}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                End Workout
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>

      <FormTipsSheet visible={showTips} onClose={() => setShowTips(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    ...Typography.stateLabel,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  powerBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
    gap: Spacing['2xl'],
  },
  countdown: {
    ...Typography.countdown,
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
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controls: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  mainButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
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
