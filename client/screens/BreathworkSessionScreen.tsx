import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  AppState,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useAudioPlayer } from "expo-audio";
import BreathCircle from "@/components/breathwork/BreathCircle";
import {
  BreathPhase,
  PhaseStep,
  BREATHWORK_AUDIO_SOURCES,
  getBreathworkColors,
  getModeConfig,
  ENERGIZE_SIGH_PHASES,
} from "@/constants/breathworkModes";
import { useTheme } from "@/hooks/useTheme";
import {
  ANIM_DURATION_ENTER,
  ANIM_DURATION_CONTENT,
  ANIM_DURATION_INTRO,
  ANIM_DURATION_MICRO_SETTLE,
} from "@/constants/animation";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SessionRoute = RouteProp<RootStackParamList, "BreathworkSession">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SessionState =
  | "intro"
  | "breathing"
  | "sigh_phase"
  | "transition"
  | "outro"
  | "complete";

export default function BreathworkSessionScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SessionRoute>();
  const { mode } = route.params;
  const config = getModeConfig(mode);
  const { isDark } = useTheme();
  const bwColors = getBreathworkColors(isDark);

  const [sessionState, setSessionState] = useState<SessionState>("intro");
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>("inhale");
  const [phaseLabel, setPhaseLabel] = useState("GET READY");
  const [phaseDuration, setPhaseDuration] = useState(4);
  const [totalSecondsLeft, setTotalSecondsLeft] = useState(
    config.totalDuration,
  );
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [, setMidpointPlayed] = useState(false);
  const [phaseElapsed, setPhaseElapsed] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseIndexRef = useRef(0);
  const isRunningRef = useRef(true);
  const sighCountRef = useRef(0);
  const sessionStateRef = useRef<SessionState>("intro");
  const clipPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionWallClockStartRef = useRef<number | null>(null);
  const transitionStartWallClockRef = useRef<number | null>(null);
  const phaseStartWallClockRef = useRef<number>(Date.now());
  const phaseDurationRef = useRef<number>(4);
  const currentPhaseRef = useRef<BreathPhase>("inhale");
  const currentPhaseClipRef = useRef<
    keyof typeof BREATHWORK_AUDIO_SOURCES | null
  >(null);

  const introPlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES[config.introClip],
  );
  const outroPlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES[config.outroClip],
  );

  const calmInhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.calm_inhale);
  const calmHoldTopPlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES.calm_hold_top,
  );
  const calmExhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.calm_exhale);
  const calmHoldBottomPlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES.calm_hold_bottom,
  );

  const energizeSighInhalePlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES.energize_sigh_inhale,
  );
  const energizeSighExhalePlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES.energize_sigh_exhale,
  );
  const energizeTransitionPlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES.energize_transition,
  );
  const energizeInhalePlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES.energize_inhale,
  );
  const energizeExhalePlayer = useAudioPlayer(
    BREATHWORK_AUDIO_SOURCES.energize_exhale,
  );

  const pfInhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.pf_inhale);
  const pfExhalePlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.pf_exhale);
  const pfMidpointPlayer = useAudioPlayer(BREATHWORK_AUDIO_SOURCES.pf_midpoint);

  const allPhasePlayers = useRef([
    calmInhalePlayer,
    calmHoldTopPlayer,
    calmExhalePlayer,
    calmHoldBottomPlayer,
    energizeSighInhalePlayer,
    energizeSighExhalePlayer,
    energizeTransitionPlayer,
    energizeInhalePlayer,
    energizeExhalePlayer,
    pfInhalePlayer,
    pfExhalePlayer,
    pfMidpointPlayer,
  ]);

  useEffect(() => {
    allPhasePlayers.current = [
      calmInhalePlayer,
      calmHoldTopPlayer,
      calmExhalePlayer,
      calmHoldBottomPlayer,
      energizeSighInhalePlayer,
      energizeSighExhalePlayer,
      energizeTransitionPlayer,
      energizeInhalePlayer,
      energizeExhalePlayer,
      pfInhalePlayer,
      pfExhalePlayer,
      pfMidpointPlayer,
    ];
  }, [
    calmInhalePlayer,
    calmHoldTopPlayer,
    calmExhalePlayer,
    calmHoldBottomPlayer,
    energizeSighInhalePlayer,
    energizeSighExhalePlayer,
    energizeTransitionPlayer,
    energizeInhalePlayer,
    energizeExhalePlayer,
    pfInhalePlayer,
    pfExhalePlayer,
    pfMidpointPlayer,
  ]);

  const stopAllAudio = useCallback(() => {
    introPlayer.pause();
    outroPlayer.pause();
    for (const p of allPhasePlayers.current) {
      try {
        p.pause();
      } catch {}
    }
  }, [introPlayer, outroPlayer]);

  const playClip = useCallback(
    async (clipKey: keyof typeof BREATHWORK_AUDIO_SOURCES | null) => {
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
        try {
          if (clipPlayTimerRef.current) clearTimeout(clipPlayTimerRef.current);
          player.pause();
          player.seekTo(0);
          clipPlayTimerRef.current = setTimeout(() => {
            if (!isRunningRef.current) return;
            try {
              player.play();
            } catch (e) {
              console.warn("[Breathwork] play error:", e);
            }
          }, 150);
        } catch (e) {
          console.warn("[Breathwork] clip error:", e);
        }
      }
    },
    [
      calmInhalePlayer,
      calmHoldTopPlayer,
      calmExhalePlayer,
      calmHoldBottomPlayer,
      energizeSighInhalePlayer,
      energizeSighExhalePlayer,
      energizeTransitionPlayer,
      energizeInhalePlayer,
      energizeExhalePlayer,
      pfInhalePlayer,
      pfExhalePlayer,
      pfMidpointPlayer,
    ],
  );

  const breathHapticTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearBreathHaptics = useCallback(() => {
    breathHapticTimers.current.forEach((t) => clearTimeout(t));
    breathHapticTimers.current = [];
  }, []);

  const triggerPhaseHaptic = useCallback(
    (phase: BreathPhase, duration: number, startOffsetSec: number = 0) => {
      clearBreathHaptics();

      if (
        phase === "inhale" ||
        phase === "exhale" ||
        phase === "sigh_inhale" ||
        phase === "sigh_exhale"
      ) {
        const totalMs = duration * 1000;
        const startOffsetMs = startOffsetSec * 1000;
        const pulseCount = 8;
        let elapsed = 0;

        for (let i = 0; i < pulseCount; i++) {
          const progress = i / (pulseCount - 1);
          const interval = 80 + progress * progress * 420;

          if (elapsed >= startOffsetMs) {
            const delay = elapsed - startOffsetMs;
            const capturedProgress = progress;
            const timer = setTimeout(() => {
              if (!isRunningRef.current) return;
              const intensity =
                capturedProgress < 0.5
                  ? Haptics.ImpactFeedbackStyle.Medium
                  : Haptics.ImpactFeedbackStyle.Light;
              Haptics.impactAsync(intensity);
            }, delay);
            breathHapticTimers.current.push(timer);
          }

          elapsed += interval;
          if (elapsed > totalMs * 0.85) break;
        }
      } else if (startOffsetSec <= 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [clearBreathHaptics],
  );

  const startPhase = useCallback(
    (phases: PhaseStep[], index: number) => {
      if (!isRunningRef.current) return;
      const step = phases[index];
      phaseStartWallClockRef.current = Date.now();
      phaseDurationRef.current = step.duration;
      currentPhaseRef.current = step.phase;
      setPhaseElapsed(0);
      setCurrentPhase(step.phase);
      setPhaseDuration(step.duration);
      setPhaseLabel(step.label);
      currentPhaseClipRef.current = step.audioClip;
      triggerPhaseHaptic(step.phase, step.duration);
      playClip(step.audioClip);
    },
    [triggerPhaseHaptic, playClip],
  );

  const advancePhase = useCallback(() => {
    if (!isRunningRef.current) return;

    const inSighPhase = mode === "energize" && sighCountRef.current < 4;
    const phases = inSighPhase ? ENERGIZE_SIGH_PHASES : config.phases;

    const nextIndex = (phaseIndexRef.current + 1) % phases.length;
    const isNewCycle = nextIndex === 0;

    if (inSighPhase && isNewCycle) {
      sighCountRef.current += 1;
      if (sighCountRef.current >= 4) {
        setSessionState("transition");
        sessionStateRef.current = "transition";
        transitionStartWallClockRef.current = Date.now();
        currentPhaseClipRef.current = "energize_transition";
        playClip("energize_transition");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPhaseLabel("FIND YOUR RHYTHM");
        transitionTimerRef.current = setTimeout(() => {
          if (!isRunningRef.current) return;
          setSessionState("breathing");
          sessionStateRef.current = "breathing";
          phaseIndexRef.current = 0;
          startPhase(config.phases, 0);
          phaseTimerRef.current = setTimeout(
            advancePhase,
            config.phases[0].duration * 1000,
          );
        }, 5000);
        return;
      }
    }

    if (isNewCycle) {
      setCyclesCompleted((prev) => prev + 1);
    }

    phaseIndexRef.current = nextIndex;
    startPhase(phases, nextIndex);
    phaseTimerRef.current = setTimeout(
      advancePhase,
      phases[nextIndex].duration * 1000,
    );
  }, [mode, config.phases, playClip, startPhase]);

  // Immutable snapshot of every value the two mount-only effects need,
  // captured once on the first render (session start). After that the ref
  // is never overwritten, so callback identity churn during audio playback
  // cannot re-run the effects or restart an in-progress session.
  const sessionDepsRef = useRef<{
    advancePhase: typeof advancePhase;
    startPhase: typeof startPhase;
    playClip: typeof playClip;
    stopAllAudio: typeof stopAllAudio;
    clearBreathHaptics: typeof clearBreathHaptics;
    triggerPhaseHaptic: typeof triggerPhaseHaptic;
    introPlayer: typeof introPlayer;
    outroPlayer: typeof outroPlayer;
    navigation: typeof navigation;
    mode: typeof mode;
    config: typeof config;
  } | null>(null);
  if (!sessionDepsRef.current) {
    sessionDepsRef.current = {
      advancePhase,
      startPhase,
      playClip,
      stopAllAudio,
      clearBreathHaptics,
      triggerPhaseHaptic,
      introPlayer,
      outroPlayer,
      navigation,
      mode,
      config,
    };
  }

  // Mount-only: launch intro audio then transition into the first active phase.
  useEffect(() => {
    const deps = sessionDepsRef.current!;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deps.introPlayer.play();

    const introTimeout = setTimeout(() => {
      if (!isRunningRef.current) return;
      const d = sessionDepsRef.current!;

      if (d.mode === "energize") {
        setSessionState("sigh_phase");
        sessionStateRef.current = "sigh_phase";
        phaseIndexRef.current = 0;
        d.startPhase(ENERGIZE_SIGH_PHASES, 0);
        phaseTimerRef.current = setTimeout(
          d.advancePhase,
          ENERGIZE_SIGH_PHASES[0].duration * 1000,
        );
      } else {
        setSessionState("breathing");
        sessionStateRef.current = "breathing";
        phaseIndexRef.current = 0;
        d.startPhase(d.config.phases, 0);
        phaseTimerRef.current = setTimeout(
          d.advancePhase,
          d.config.phases[0].duration * 1000,
        );
      }
    }, deps.config.introDuration * 1000);

    return () => {
      clearTimeout(introTimeout);
    };
  }, []);

  // Mount-only: run the session countdown and trigger the outro when time is up.
  useEffect(() => {
    sessionWallClockStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (!isRunningRef.current) return;

      const d = sessionDepsRef.current!;
      const elapsedSec =
        (Date.now() - sessionWallClockStartRef.current!) / 1000;
      const next = Math.max(0, d.config.totalDuration - Math.round(elapsedSec));

      setTotalSecondsLeft(() => {
        if (
          next <= d.config.outroDuration &&
          sessionStateRef.current !== "outro" &&
          sessionStateRef.current !== "complete"
        ) {
          if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
          if (transitionTimerRef.current)
            clearTimeout(transitionTimerRef.current);
          setSessionState("outro");
          sessionStateRef.current = "outro";
          setPhaseLabel("");
          d.stopAllAudio();
          d.outroPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }, 400);
          outroTimerRef.current = setTimeout(() => {
            if (!isRunningRef.current) return;
            isRunningRef.current = false;
            sessionStateRef.current = "complete";
            setSessionState("complete");
            const { navigation: nav, mode: m } = sessionDepsRef.current!;
            nav.replace("BreathworkSummary", { mode: m, completed: true });
          }, d.config.outroDuration * 1000);
        }

        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }

        if (d.config.midpointClip && d.config.midpointTime) {
          const elapsed = d.config.totalDuration - next;
          if (
            elapsed >= d.config.midpointTime &&
            elapsed < d.config.midpointTime + 2
          ) {
            setMidpointPlayed((prevPlayed) => {
              if (!prevPlayed) {
                sessionDepsRef.current!.playClip(d.config.midpointClip!);
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
      if (clipPlayTimerRef.current) clearTimeout(clipPlayTimerRef.current);
      sessionDepsRef.current.clearBreathHaptics();
      isRunningRef.current = false;
    };
  }, []);

  // Mount-only: resync countdown and resume audio when app returns to foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        nextState === "active" &&
        sessionWallClockStartRef.current !== null &&
        isRunningRef.current
      ) {
        const state = sessionStateRef.current;
        if (
          state === "breathing" ||
          state === "sigh_phase" ||
          state === "transition"
        ) {
          const elapsed =
            (Date.now() - sessionWallClockStartRef.current) / 1000;
          const corrected = Math.max(
            0,
            sessionDepsRef.current!.config.totalDuration - Math.round(elapsed),
          );
          setTotalSecondsLeft(corrected);

          const d = sessionDepsRef.current!;

          // Helper: fast-forward through a repeating phase array by
          // overrunMs and return the new index + remaining ms.
          const fastForwardPhases = (
            phases: typeof d.config.phases,
            startIdx: number,
            overrunMs: number,
          ) => {
            let idx = startIdx;
            let remaining = overrunMs;
            while (remaining >= phases[idx].duration * 1000) {
              remaining -= phases[idx].duration * 1000;
              idx = (idx + 1) % phases.length;
            }
            return { idx, remaining };
          };

          // Helper: enter the breathing state at the wall-clock-correct phase.
          // Always starts fast-forward from index 0 because breathing always
          // begins at phase 0 (the transition timer fires startPhase(phases, 0)
          // before any advancePhase call).
          const resumeBreathing = (overrunIntoBreathingMs: number) => {
            setSessionState("breathing");
            sessionStateRef.current = "breathing";
            const phases = d.config.phases;
            const { idx, remaining } = fastForwardPhases(
              phases,
              0,
              overrunIntoBreathingMs,
            );
            phaseIndexRef.current = idx;
            d.startPhase(phases, idx);
            phaseTimerRef.current = setTimeout(
              d.advancePhase,
              phases[idx].duration * 1000 - remaining,
            );
          };

          if (state === "transition") {
            // Reconcile the 5-second transition timer.
            if (transitionStartWallClockRef.current !== null) {
              const transitionElapsedMs =
                Date.now() - transitionStartWallClockRef.current;
              if (transitionElapsedMs >= 5000) {
                // Transition already done – jump straight into breathing.
                if (transitionTimerRef.current)
                  clearTimeout(transitionTimerRef.current);
                if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
                resumeBreathing(transitionElapsedMs - 5000);
              } else {
                // Still in transition – reschedule the remaining portion.
                if (transitionTimerRef.current)
                  clearTimeout(transitionTimerRef.current);
                transitionTimerRef.current = setTimeout(() => {
                  if (!isRunningRef.current) return;
                  setSessionState("breathing");
                  sessionStateRef.current = "breathing";
                  phaseIndexRef.current = 0;
                  d.startPhase(d.config.phases, 0);
                  phaseTimerRef.current = setTimeout(
                    d.advancePhase,
                    d.config.phases[0].duration * 1000,
                  );
                }, 5000 - transitionElapsedMs);
              }
            }
          } else {
            const phaseElapsedMs = Date.now() - phaseStartWallClockRef.current;
            const phaseOverrunMs =
              phaseElapsedMs - phaseDurationRef.current * 1000;

            if (phaseOverrunMs > 0) {
              // One or more phase deadlines fired while backgrounded.
              if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);

              if (state === "sigh_phase") {
                // Walk forward through sigh phases, tracking cycle completions.
                const sighPhases = ENERGIZE_SIGH_PHASES;
                let idx = (phaseIndexRef.current + 1) % sighPhases.length;
                let overrunMs = phaseOverrunMs;
                let sighCount = sighCountRef.current;
                let enteredTransition = false;

                while (true) {
                  const isNewCycle = idx === 0;
                  if (isNewCycle) {
                    sighCount += 1;
                    if (sighCount >= 4) {
                      // overrunMs is time elapsed since transition started.
                      enteredTransition = true;
                      break;
                    }
                  }
                  if (overrunMs < sighPhases[idx].duration * 1000) break;
                  overrunMs -= sighPhases[idx].duration * 1000;
                  idx = (idx + 1) % sighPhases.length;
                }

                sighCountRef.current = sighCount;

                if (enteredTransition) {
                  if (overrunMs >= 5000) {
                    // Past the transition too – enter breathing directly.
                    if (transitionTimerRef.current)
                      clearTimeout(transitionTimerRef.current);
                    resumeBreathing(overrunMs - 5000);
                  } else {
                    // Mid-transition – show the transition UI and reschedule.
                    setSessionState("transition");
                    sessionStateRef.current = "transition";
                    transitionStartWallClockRef.current =
                      Date.now() - overrunMs;
                    currentPhaseClipRef.current = "energize_transition";
                    d.playClip("energize_transition");
                    setPhaseLabel("FIND YOUR RHYTHM");
                    if (transitionTimerRef.current)
                      clearTimeout(transitionTimerRef.current);
                    transitionTimerRef.current = setTimeout(() => {
                      if (!isRunningRef.current) return;
                      setSessionState("breathing");
                      sessionStateRef.current = "breathing";
                      phaseIndexRef.current = 0;
                      d.startPhase(d.config.phases, 0);
                      phaseTimerRef.current = setTimeout(
                        d.advancePhase,
                        d.config.phases[0].duration * 1000,
                      );
                    }, 5000 - overrunMs);
                  }
                } else {
                  // Still within sigh_phase – resume the correct sigh phase.
                  phaseIndexRef.current = idx;
                  d.startPhase(sighPhases, idx);
                  phaseTimerRef.current = setTimeout(
                    d.advancePhase,
                    sighPhases[idx].duration * 1000 - overrunMs,
                  );
                }
              } else {
                // "breathing" state – simple repeating phase cycle.
                const { idx, remaining } = fastForwardPhases(
                  d.config.phases,
                  (phaseIndexRef.current + 1) % d.config.phases.length,
                  phaseOverrunMs,
                );
                phaseIndexRef.current = idx;
                d.startPhase(d.config.phases, idx);
                phaseTimerRef.current = setTimeout(
                  d.advancePhase,
                  d.config.phases[idx].duration * 1000 - remaining,
                );
              }
            } else {
              // Phase still in progress – sync display and resume audio.
              const phaseElapsedSec = Math.min(
                phaseElapsedMs / 1000,
                phaseDurationRef.current,
              );
              setPhaseElapsed(phaseElapsedSec);
              d.triggerPhaseHaptic(
                currentPhaseRef.current,
                phaseDurationRef.current,
                phaseElapsedSec,
              );
              const clipKey = currentPhaseClipRef.current;
              if (clipKey) {
                d.playClip(clipKey);
              }
            }
          }
        }
      }
    });

    return () => {
      subscription.remove();
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
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalCycles = config.cyclesEstimate;
  const progressDots = Math.min(totalCycles, 20);
  const filledDots = Math.min(
    Math.round((cyclesCompleted / totalCycles) * progressDots),
    progressDots,
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: bwColors.bg_session },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={handleExit}
          style={styles.exitButton}
          testID="breathwork-exit-button"
        >
          <Feather name="x" size={24} color={bwColors.timer_text} />
        </Pressable>
        <Text
          style={[styles.timer, { color: bwColors.timer_text }]}
          testID="breathwork-timer"
        >
          {formatTime(totalSecondsLeft)}
        </Text>
      </View>

      <View style={styles.centerContent}>
        {sessionState === "intro" ? (
          <Animated.View
            entering={FadeIn.duration(ANIM_DURATION_INTRO)}
            style={styles.introContainer}
          >
            <View
              style={[
                styles.introCirclePlaceholder,
                { backgroundColor: bwColors.accentSoft },
              ]}
            >
              <Feather
                name={config.icon as any}
                size={48}
                color={bwColors.accent}
              />
            </View>
            <Text style={[styles.introTitle, { color: bwColors.phase_label }]}>
              {config.name}
            </Text>
            <Text style={[styles.introTechnique, { color: bwColors.accent }]}>
              {config.subtitle}
            </Text>
            <Text
              style={[styles.introDescription, { color: bwColors.timer_text }]}
            >
              {config.description}
            </Text>
            <Text
              style={[styles.introSubtitle, { color: bwColors.timer_text }]}
            >
              Listen and relax...
            </Text>
          </Animated.View>
        ) : sessionState === "transition" ? (
          <Animated.View
            entering={FadeIn.duration(ANIM_DURATION_CONTENT)}
            style={styles.introContainer}
          >
            <BreathCircle phase="hold_top" phaseDuration={5} />
            <Text style={[styles.phaseText, { color: bwColors.phase_label }]}>
              {phaseLabel}
            </Text>
          </Animated.View>
        ) : sessionState === "outro" ? (
          <Animated.View
            entering={FadeIn.duration(ANIM_DURATION_CONTENT)}
            style={styles.introContainer}
          >
            <BreathCircle
              phase="hold_bottom"
              phaseDuration={config.outroDuration}
            />
            <Text style={[styles.outroText, { color: bwColors.accent }]}>
              Session Complete
            </Text>
          </Animated.View>
        ) : (
          <>
            <BreathCircle
              phase={currentPhase}
              phaseDuration={phaseDuration}
              elapsedSeconds={phaseElapsed}
            />
            <Animated.View
              key={phaseLabel}
              entering={FadeIn.duration(ANIM_DURATION_ENTER)}
              exiting={FadeOut.duration(ANIM_DURATION_MICRO_SETTLE)}
            >
              <Text
                style={[styles.phaseText, { color: bwColors.phase_label }]}
                testID="breathwork-phase-label"
              >
                {phaseLabel}
              </Text>
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
                {
                  backgroundColor:
                    i < filledDots ? bwColors.accent : bwColors.accentSoft,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.cycleText, { color: bwColors.timer_text }]}>
          {cyclesCompleted > 0
            ? `${cyclesCompleted} / ${totalCycles} cycles`
            : ""}
        </Text>
      </View>

      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: bwColors.modalBg }]}
          >
            <Text style={[styles.modalTitle, { color: bwColors.phase_label }]}>
              End session?
            </Text>
            <Text style={[styles.modalMessage, { color: bwColors.timer_text }]}>
              {"Your progress won't be logged."}
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowExitModal(false)}
                style={[
                  styles.modalButton,
                  { backgroundColor: bwColors.accentSoft },
                ]}
                testID="breathwork-continue-button"
              >
                <Text
                  style={[
                    styles.modalButtonTextPrimary,
                    { color: bwColors.accent },
                  ]}
                >
                  Continue
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmExit}
                style={[styles.modalButton, styles.modalButtonDanger]}
                testID="breathwork-end-button"
              >
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
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  exitButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: {
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  introContainer: {
    alignItems: "center",
    gap: 24,
  },
  introCirclePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  introTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  introTechnique: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: -12,
  },
  introDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  introSubtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  phaseText: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 24,
    letterSpacing: 2,
  },
  outroText: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 24,
  },
  bottomBar: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cycleText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalMessage: {
    fontSize: 14,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonDanger: {
    backgroundColor: "rgba(255, 51, 102, 0.15)",
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextDanger: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3366",
  },
});
