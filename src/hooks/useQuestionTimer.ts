import { useState, useEffect, useRef, useCallback } from 'react';
import { APP_CONFIG } from '@/config/app.config';
import type { VoiceInterviewState } from '@/types/interview.types';

interface UseQuestionTimerOptions {
  state: VoiceInterviewState;
  isPlaying: boolean;
  isCodingQuestion: boolean;
  onTimeout: () => void;
  onMaxSkips: () => void;
}

export function useQuestionTimer({ state, isPlaying, isCodingQuestion, onTimeout, onMaxSkips }: UseQuestionTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState<number>(APP_CONFIG.INTERVIEW_QUESTION_TIMEOUT_SECONDS);
  const [consecutiveSkips, setConsecutiveSkips] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const intervalRef = useRef<number | null>(null);
  /** The seconds still to run, kept outside React state so the countdown can act on it without a state updater. */
  const remainingRef = useRef(0);
  /** Read at the moment the time runs out, so an interviewer who is speaking (or being replayed) is never skipped. */
  const stateRef = useRef(state);
  stateRef.current = state;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const onMaxSkipsRef = useRef(onMaxSkips);
  onMaxSkipsRef.current = onMaxSkips;

  // Track previous state to detect new questions (transition into active+not-playing)
  const prevStateRef = useRef<VoiceInterviewState>(state);
  const prevIsPlayingRef = useRef(isPlaying);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTimerActive(false);
  }, []);

  const isCodingRef = useRef(isCodingQuestion);
  isCodingRef.current = isCodingQuestion;

  const startTimer = useCallback(() => {
    clearTimer();
    const timeout = isCodingRef.current
      ? APP_CONFIG.INTERVIEW_CODING_QUESTION_TIMEOUT_SECONDS
      : APP_CONFIG.INTERVIEW_QUESTION_TIMEOUT_SECONDS;
    remainingRef.current = timeout;
    setSecondsLeft(timeout);
    setIsTimerActive(true);

    intervalRef.current = window.setInterval(() => {
      remainingRef.current -= 1;
      setSecondsLeft(Math.max(0, remainingRef.current));
      if (remainingRef.current > 0) return;

      // The time given is up: say so once and stop. Restarting the countdown meant a question the candidate
      // never answered was held open for ever, with the same reminder every few minutes. The page now moves the
      // interview on, as an interviewer would when someone does not answer.
      //
      // Done here rather than inside a state updater: React may run an updater more than once, which could skip
      // the question twice.
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsTimerActive(false);
      // Only a question that is waiting to be answered can run out of time. If the interviewer is speaking, as in a
      // replay started the moment before, or the candidate has begun answering, the question is not skipped; the
      // countdown starts again when the audio ends.
      if (stateRef.current !== 'active' || isPlayingRef.current) return;
      window.setTimeout(() => onTimeoutRef.current(), 0);
    }, 1000);
  }, [clearTimer]);

  const resetSkipCounter = useCallback(() => {
    setConsecutiveSkips(0);
  }, []);

  const incrementSkipCounter = useCallback(() => {
    setConsecutiveSkips((prev) => {
      const next = prev + 1;
      if (next >= APP_CONFIG.INTERVIEW_MAX_CONSECUTIVE_SKIPS) {
        // Defer the callback to avoid calling it during state update
        setTimeout(() => onMaxSkipsRef.current(), 0);
      }
      return next;
    });
  }, []);

  // Timer logic: start when active + not playing, stop otherwise
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    const prevState = prevStateRef.current;
    prevStateRef.current = state;
    prevIsPlayingRef.current = isPlaying;

    if (state === 'active' && !isPlaying) {
      // Start/restart timer when:
      // 1. Just transitioned to active (from processing/starting/etc)
      // 2. TTS just finished (isPlaying went from true to false while active)
      const justBecameActive = prevState !== 'active';
      const ttsJustFinished = wasPlaying && !isPlaying;

      if (justBecameActive || ttsJustFinished) {
        startTimer();
      }
    } else {
      // Stop timer when candidate starts answering, processing, or TTS is playing
      clearTimer();
    }
  }, [state, isPlaying, startTimer, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    secondsLeft,
    isTimerActive,
    consecutiveSkips,
    resetSkipCounter,
    incrementSkipCounter,
  };
}
