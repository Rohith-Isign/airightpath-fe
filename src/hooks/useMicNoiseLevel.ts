import { useState, useEffect, useRef } from 'react';
import { PROCTORING_CONFIG } from '@/config/proctoring.config';

/**
 * Green / amber / red reading of the room the candidate is sitting in.
 *
 * `quiet` and `moderate` both let the exam start; `loud` is the only blocking
 * state, and it is deliberately slow to trigger — the level has to stay above
 * the threshold for `sustainMs` before it turns red, so a cough, a door, or a
 * notification chime cannot lock someone out of an exam they are ready for.
 */
export type NoiseBand = 'quiet' | 'moderate' | 'loud';

interface UseMicNoiseLevelResult {
  /** Smoothed RMS of the mic signal in dBFS (about -90 silent, 0 clipping). */
  db: number;
  /** The same reading mapped to 0–100 for a meter. */
  level: number;
  band: NoiseBand;
  /** True once at least one real reading has landed. */
  measuring: boolean;
}

/** dBFS window the meter spans; below the floor reads empty, above it reads full. */
const METER_FLOOR_DB = -60;
const METER_CEILING_DB = -15;

/** Weight of each new sample in the running average — low value = steady meter. */
const SMOOTHING = 0.12;
/** How often the readout is pushed to the screen, however often the microphone is sampled. */
const PAINT_INTERVAL_MS = 120;
/** The longest a single frame is allowed to count for when accumulating sustained noise. */
const MAX_FRAME_MS = 100;

/**
 * Measures background noise on a live mic stream via the Web Audio API.
 *
 * Pass the stream from getUserMedia; monitoring starts and stops with it, and
 * every audio node is torn down on unmount so no AudioContext is left running
 * once the candidate moves on to the exam.
 */
export function useMicNoiseLevel(stream: MediaStream | null): UseMicNoiseLevelResult {
  const config = PROCTORING_CONFIG.noise;

  const [db, setDb] = useState(METER_FLOOR_DB);
  const [band, setBand] = useState<NoiseBand>('quiet');
  const [measuring, setMeasuring] = useState(false);

  // Milliseconds the signal has been continuously above blockDb.
  const loudForMsRef = useRef(0);
  const lastFrameRef = useRef(0);
  const smoothedRef = useRef(METER_FLOOR_DB);
  // When the readout was last pushed to the screen. The meter is sampled every frame, but re-rendering the whole
  // instructions page 60 times a second made it shimmer while scrolling.
  const lastPaintRef = useRef(0);
  const bandRef = useRef<NoiseBand>('quiet');

  useEffect(() => {
    if (!config.enabled || !stream || stream.getAudioTracks().length === 0) return;

    let audioContext: AudioContext | null = null;
    let rafId: number | null = null;
    let cancelled = false;

    try {
      audioContext = new AudioContext();
      // Chrome starts contexts suspended until a gesture; the candidate has
      // already clicked to grant permissions, so this resolves immediately.
      void audioContext.resume().catch(() => {});

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(stream).connect(analyser);

      const samples = new Float32Array(analyser.fftSize);
      smoothedRef.current = METER_FLOOR_DB;
      loudForMsRef.current = 0;
      lastFrameRef.current = performance.now();

      const tick = () => {
        if (cancelled) return;

        analyser.getFloatTimeDomainData(samples);

        // RMS of the waveform → dBFS. The 1e-8 floor keeps log10 finite on a
        // perfectly silent (muted) track.
        let sumSquares = 0;
        for (const sample of samples) sumSquares += sample * sample;
        const rms = Math.sqrt(sumSquares / samples.length);
        const instantDb = 20 * Math.log10(Math.max(rms, 1e-8));

        const smoothed = smoothedRef.current + (instantDb - smoothedRef.current) * SMOOTHING;
        smoothedRef.current = smoothed;

        const now = performance.now();
        // A frame that arrives late (the tab was in the background, a notification took focus) is counted as one
        // ordinary frame, not as all the seconds it was away: otherwise one loud moment before the pause
        // reads as noise sustained through it, and the Start button stays blocked.
        const elapsed = Math.min(now - lastFrameRef.current, MAX_FRAME_MS);
        lastFrameRef.current = now;
        // The browser may suspend the audio context while the page is not in front; the meter would then read
        // its last sample forever.
        if (audioContext && audioContext.state === 'suspended') void audioContext.resume().catch(() => {});

        // Time above the red threshold accumulates; anything quieter drains it
        // twice as fast, so the meter recovers quickly once the noise stops.
        if (smoothed >= config.blockDb) {
          loudForMsRef.current = Math.min(loudForMsRef.current + elapsed, config.sustainMs * 2);
        } else {
          loudForMsRef.current = Math.max(loudForMsRef.current - elapsed * 2, 0);
        }

        // The amber band is entered at warnDb but only left 3 dB lower, so a level hovering on the line does
        // not flip the label (and the text under it) back and forth.
        const moderateFloor = bandRef.current === 'moderate' ? config.warnDb - 3 : config.warnDb;
        let nextBand: NoiseBand = 'quiet';
        if (loudForMsRef.current >= config.sustainMs) nextBand = 'loud';
        else if (smoothed >= moderateFloor) nextBand = 'moderate';
        bandRef.current = nextBand;

        if (now - lastPaintRef.current >= PAINT_INTERVAL_MS) {
          lastPaintRef.current = now;
          setDb(smoothed);
          setBand((prev) => (prev === nextBand ? prev : nextBand));
          setMeasuring(true);
        }

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    } catch {
      // Web Audio unavailable — the check reports "not measured" and the caller
      // treats that as non-blocking rather than failing the candidate.
      setMeasuring(false);
    }

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      audioContext?.close().catch(() => {});
      setMeasuring(false);
      setBand('quiet');
      setDb(METER_FLOOR_DB);
    };
  }, [stream, config.enabled, config.warnDb, config.blockDb, config.sustainMs]);

  const level = Math.round(
    Math.min(100, Math.max(0, ((db - METER_FLOOR_DB) / (METER_CEILING_DB - METER_FLOOR_DB)) * 100))
  );

  return { db, level, band, measuring };
}
