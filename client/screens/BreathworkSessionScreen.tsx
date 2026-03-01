import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useAudioPlayer } from 'expo-audio';
import BreathCircle from '@/components/breathwork/BreathCircle';
import {
  BreathworkMode,
  BreathPhase,
  PhaseStep,
  BREATHWORK_COLORS,
  BREATHWORK_AUDIO_SOURCES,
  getModeConfig,
  ENERGIZE_SIGH_PHASES,
} from '@/constants/breathworkModes';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type SessionRoute = RouteProp<RootStackParamList, 'BreathworkSession'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SessionState = 'intro' | 'breathing' | 'sigh_phase' | 'transition' | 'outro' | 'complete';

export default function BreathworkSessionScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SessionRoute>();
  const { mode } = route.params;
  const config = getModeConfig(mode);

  const [sessionState, setSessionState] = useState<SessionState>('intro');
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>('inhale');
  const [phaseLabel, setPhaseLabel] = useState('GET READY');
  const [phaseDuration, setPhaseDuration] = useState(4);
  const [totalSecondsLeft, setTotalSecondsLeft] = useState(config.totalDuration);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [midpointPlayed, setMidpointPlayed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseIndexRef = useRef(0);
  const isRunningRef = useRef(true);
  const sighCountRef = useRef(0);
  const sessionStateRef = useRef<SessionState>('intro');

  const introPlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES[config.introClip]);
  const outroPlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES[config.outroClip]);

  const calmInhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.calm_inhale);
  const calmHoldTopPlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.calm_hold_top);
  const calmExhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.calm_exhale);
  const calmHoldBottomPlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.calm_hold_bottom);

  const energizeSighInhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.energize_sigh_inhale);
  const energizeSighExhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.energize_sigh_exhale);
  const energizeTransitionPlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.energize_transition);
  const energizeInhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.energize_inhale);
  const energizeExhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.energize_exhale);

  const pfInhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.pf_inhale);
  const pfExhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.pf_exhale);
  const pfMidpointPlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.pf_midpoint);

  const allPhasePlayers = useRef([
    calmInhalePlayer, calmHoldTopPlayer, calmExhalePlayer, calmHoldBottomPlayer,
    energizeSighInhalePlayer, energizeSighExhalePlayer, energizeTransitionPlayer,
    energizeInhalePlayer, energizeExhalePlayer,
    pfInhalePlayer, pfExhalePlayer, pfMidpointPlayer,
  ]);

  useEffect(() => {
    allPhasePlayers.current = [
      calmInhalePlayer, calmHoldTopPlayer, calmExhalePlayer, calmHoldBottomPlayer,
      energizeSighInhalePlayer, energizeSighExhalePlayer, energizeTransitionPlayer,
      energizeInhalePlayer, energizeExhalePlayer,
      pfInhalePlayer, pfExhalePlayer, pfMidpointPlayer,
    ];
  }, [
    calmInhalePlayer, calmHoldTopPlayer, calmExhalePlayer, calmHoldBottomPlayer,
    energizeSighInhalePlayer, energizeSighExhalePlayer, energizeTransitionPlayer,
    energizeInhalePlayer, energizeExhalePlayer,
    pfInhalePlayer, pfExhalePlayer, pfMidpointPlayer,
  ]);

  const stopAllAudio = useCallback(() => {
    introPlayer.pause();
    outroPlayer.pause();
    for (const p of allPhasePlayers.current) {
      try { p.pause(); } catch {}
    }
  }, [introPlayer, outroPlayer]);

  const playClip = useCallback((clipKey: keyof typeof BREATHWORK_AUDIO_SOURCES | null) => {
    if (!clipKey || !isRunningRef.current) return;
    const playerMap: Record<string, ReturnType<typeof useAudioPlayer>> = {
      calm_inhale: calmInhalePlayer,
      calm_hold_top: calmHoldTopPlayer,
      calm_exhale: calmExhalePlayer,
      calm_hold_bottom: calmHoldBottomPlayer,
      energize_sigh_inhale: energizeSighInhalePlayer,
      energize_sigh_exhale: energizeSighExhalePlayer,
      energize_transition: energizeTransitionPlayer,
      energize_inhale: energizeInhalePlayer,
      energize_exhale: energizeExhalePlayer,
      pf_inhale: pfInhalePlayer,
      pf_exhale: pfExhalePlayer,
      pf_midpoint: pfMidpointPlayer,
    };
    const player = playerMap[clipKey];
    if (player) {
      player.seekTo(0);
      player.play();
    }
  }, [
    calmInhalePlayer, calmHoldTopPlayer, calmExhalePlayer, calmHoldBottomPlayer,
    energizeSighInhalePlayer, energizeSighExhalePlayer, energizeTransitionPlayer,
    energizeInhalePlayer, energizeExhalePlayer, pfInhalePlayer, pfExhalePlayer,
    pfMidpointPlayer,
  ]);

  const breathHapticTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearBreathHaptics = useCallback(() => {
    breathHapticTimers.current.forEach(t => clearTimeout(t));
    breathHapticTimers.current = [];
  }, []);

  const triggerPhaseHaptic = useCallback((phase: BreathPhase, duration: number) => {
    clearBreathHaptics();

    if (phase === 'inhale' || phase === 'exhale' || phase === 'sigh_inhale' || phase === 'sigh_exhale') {
      const totalMs = duration * 1000;
      const pulseCount = 8;
      let elapsed = 0;

      for (let i = 0; i < pulseCount; i++) {
        const progress = i / (pulseCount - 1);
        const interval = 80 + progress * progress * 420;
        const timer = setTimeout(() => {
          if (!isRunningRef.current) return;
          const intensity = progress < 0.5
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
          Haptics.impactAsync(intensity);
        }, elapsed);
        breathHapticTimers.current.push(timer);
        elapsed += interval;
        if (elapsed > totalMs * 0.85) break;
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [clearBreathHaptics]);

  const startPhase = useCallback((phases: PhaseStep[], index: number) => {
    if (!isRunningRef.current) return;
    const step = phases[index];
    setCurrentPhase(step.phase);
    setPhaseDuration(step.duration);
    setPhaseLabel(step.label);
    triggerPhaseHaptic(step.phase, step.duration);
    playClip(step.audioClip);
  }, [triggerPhaseHaptic, playClip]);

  const advancePhase = useCallback(() => {
    if (!isRunningRef.current) return;

    const inSighPhase = mode === 'energize' && sighCountRef.current < 4;
    const phases = inSighPhase ? ENERGIZE_SIGH_PHASES : config.phases;

    const nextIndex = (phaseIndexRef.current + 1) % phases.length;
    const isNewCycle = nextIndex === 0;

    if (inSighPhase && isNewCycle) {
      sighCountRef.current += 1;
      if (sighCountRef.current >= 4) {
        setSessionState('transition');
        sessionStateRef.current = 'transition';
        playClip('energize_transition');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPhaseLabel('FIND YOUR RHYTHM');
        transitionTimerRef.current = setTimeout(() => {
          if (!isRunningRef.current) return;
          setSessionState('breathing');
          sessionStateRef.current = 'breathing';
          phaseIndexRef.current = 0;
          startPhase(config.phases, 0);
          phaseTimerRef.current = setTimeout(advancePhase, config.phases[0].duration * 1000);
        }, 5000);
        return;
      }
    }

    if (isNewCycle) {
      setCyclesCompleted(prev => prev + 1);
    }

    phaseIndexRef.current = nextIndex;
    startPhase(phases, nextIndex);
    phaseTimerRef.current = setTimeout(advancePhase, phases[nextIndex].duration * 1000);
  }, [mode, config.phases, playClip, startPhase]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    introPlayer.play();

    const introTimeout = setTimeout(() => {
      if (!isRunningRef.current) return;

      if (mode === 'energize') {
        setSessionState('sigh_phase');
        sessionStateRef.current = 'sigh_phase';
        phaseIndexRef.current = 0;
        startPhase(ENERGIZE_SIGH_PHASES, 0);
        phaseTimerRef.current = setTimeout(advancePhase, ENERGIZE_SIGH_PHASES[0].duration * 1000);
      } else {
        setSessionState('breathing');
        sessionStateRef.current = 'breathing';
        phaseIndexRef.current = 0;
        startPhase(config.phases, 0);
        phaseTimerRef.current = setTimeout(advancePhase, config.phases[0].duration * 1000);
      }
    }, config.introDuration * 1000);

    return () => {
      clearTimeout(introTimeout);
    };
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!isRunningRef.current) return;

      setTotalSecondsLeft(prev => {
        const next = prev - 1;

        if (next <= config.outroDuration && sessionStateRef.current !== 'outro' && sessionStateRef.current !== 'complete') {
          if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
          setSessionState('outro');
          sessionStateRef.current = 'outro';
          setPhaseLabel('');
          stopAllAudio();
          outroPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }, 400);
          outroTimerRef.current = setTimeout(() => {
            if (!isRunningRef.current) return;
            isRunningRef.current = false;
            sessionStateRef.current = 'complete';
            setSessionState('complete');
            navigation.replace('BreathworkSummary', { mode, completed: true });
          }, config.outroDuration * 1000);
        }

        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }

        if (config.midpointClip && config.midpointTime) {
          const elapsed = config.totalDuration - next;
          if (elapsed >= config.midpointTime && elapsed < config.midpointTime + 2) {
            setMidpointPlayed(prev => {
              if (!prev) {
                playClip(config.midpointClip!);
              }
              return true;
            });
          }
        }

        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (outroTimerRef.current) clearTimeout(outroTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      clearBreathHaptics();
      isRunningRef.current = false;
    };
  }, []);

  const handleExit = () => {
    setShowExitModal(true);
  };

  const confirmExit = () => {
    isRunningRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (outroTimerRef.current) clearTimeout(outroTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    clearBreathHaptics();
    stopAllAudio();
    setShowExitModal(false);
    navigation.goBack();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalCycles = config.cyclesEstimate;
  const progressDots = Math.min(totalCycles, 20);
  const filledDots = Math.min(Math.round((cyclesCompleted / totalCycles) * progressDots), progressDots);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={handleExit} style={styles.exitButton} testID="breathwork-exit-button">
          <Feather name="x" size={24} color={BREATHWORK_COLORS.timer_text} />
        </Pressable>
        <Text style={styles.timer} testID="breathwork-timer">{formatTime(totalSecondsLeft)}</Text>
      </View>

      <View style={styles.centerContent}>
        {sessionState === 'intro' ? (
          <Animated.View entering={FadeIn.duration(600)} style={styles.introContainer}>
            <View style={styles.introCirclePlaceholder}>
              <Feather name={config.icon as any} size={48} color={BREATHWORK_COLORS.circle_inhale} />
            </View>
            <Text style={styles.introTitle}>{config.name}</Text>
            <Text style={styles.introTechnique}>{config.subtitle}</Text>
            <Text style={styles.introDescription}>{config.description}</Text>
            <Text style={styles.introSubtitle}>Listen and relax...</Text>
          </Animated.View>
        ) : sessionState === 'transition' ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.introContainer}>
            <BreathCircle phase="hold_top" phaseDuration={5} />
            <Text style={styles.phaseText}>{phaseLabel}</Text>
          </Animated.View>
        ) : sessionState === 'outro' ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.introContainer}>
            <BreathCircle phase="hold_bottom" phaseDuration={config.outroDuration} />
            <Text style={styles.outroText}>Session Complete</Text>
          </Animated.View>
        ) : (
          <>
            <BreathCircle phase={currentPhase} phaseDuration={phaseDuration} />
            <Animated.View key={phaseLabel} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
              <Text style={styles.phaseText} testID="breathwork-phase-label">{phaseLabel}</Text>
            </Animated.View>
          </>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dotsContainer}>
          {Array.from({ length: progressDots }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < filledDots ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          ))}
        </View>
        <Text style={styles.cycleText}>
          {cyclesCompleted > 0 ? `${cyclesCompleted} / ${totalCycles} cycles` : ''}
        </Text>
      </View>

      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>End session?</Text>
            <Text style={styles.modalMessage}>Your progress won't be logged.</Text>
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setShowExitModal(false)} style={styles.modalButton} testID="breathwork-continue-button">
                <Text style={styles.modalButtonTextPrimary}>Continue</Text>
              </Pressable>
              <Pressable onPress={confirmExit} style={[styles.modalButton, styles.modalButtonDanger]} testID="breathwork-end-button">
                <Text style={styles.modalButtonTextDanger}>End</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BREATHWORK_COLORS.bg_session,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  exitButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
    color: BREATHWORK_COLORS.timer_text,
    fontVariant: ['tabular-nums'],
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introContainer: {
    alignItems: 'center',
    gap: 24,
  },
  introCirclePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 180, 197, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: BREATHWORK_COLORS.phase_label,
  },
  introTechnique: {
    fontSize: 14,
    fontWeight: '600',
    color: BREATHWORK_COLORS.circle_inhale,
    marginTop: -12,
  },
  introDescription: {
    fontSize: 14,
    color: BREATHWORK_COLORS.timer_text,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  introSubtitle: {
    fontSize: 16,
    color: BREATHWORK_COLORS.timer_text,
    marginTop: 4,
  },
  phaseText: {
    fontSize: 22,
    fontWeight: '700',
    color: BREATHWORK_COLORS.phase_label,
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 2,
  },
  outroText: {
    fontSize: 22,
    fontWeight: '700',
    color: BREATHWORK_COLORS.circle_inhale,
    textAlign: 'center',
    marginTop: 24,
  },
  bottomBar: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: BREATHWORK_COLORS.circle_inhale,
  },
  dotEmpty: {
    backgroundColor: 'rgba(0, 180, 197, 0.2)',
  },
  cycleText: {
    fontSize: 12,
    color: BREATHWORK_COLORS.timer_text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1a2e42',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BREATHWORK_COLORS.phase_label,
  },
  modalMessage: {
    fontSize: 14,
    color: BREATHWORK_COLORS.timer_text,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 180, 197, 0.15)',
  },
  modalButtonDanger: {
    backgroundColor: 'rgba(255, 51, 102, 0.15)',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: BREATHWORK_COLORS.circle_inhale,
  },
  modalButtonTextDanger: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3366',
  },
});
