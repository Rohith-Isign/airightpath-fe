import { PROCTORING_CONFIG } from '@/config/proctoring.config';
import { recordingSync } from '@/services/recording-sync.service';
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMediaRecorderOptions {
  mimeType?: string;
  onDataAvailable?: (blob: Blob) => void;
  timeslice?: number;
  /**
   * False opens the stream but records nothing: no MediaRecorder, no chunks,
   * and `stopAndGetBlob` resolves null.
   *
   * The camera is wanted for two unrelated reasons — the recording kept as
   * evidence, and the live frames face detection reads — and a deployment can
   * want the second without the first. Without this the only way to stop
   * recording was to stop opening the camera, which silently took the face
   * check down with it.
   */
  record?: boolean;
  /**
   * Told when the camera stopped delivering and what was done about it, so the
   * interview can put it on the record instead of ending with a silent,
   * empty recording.
   */
  onProblem?: (message: string) => void;
  /**
   * Close the recording off every `segmentMs` and upload that part in the
   * background, then carry on recording on the same stream.
   */
  segmentMs?: number;
  /**
   * Keep every chunk in the browser's own store as it is recorded and upload
   * finished parts in the background, so the recording survives a closed tab
   * and the candidate never waits for it. The schedule is read lazily because
   * the interview has not been created when this hook is.
   */
  persist?: { scheduleId: () => number | null | undefined };
  /**
   * The <video> showing the camera. Watched so a preview that has frozen or gone black while the camera claims to be
   * on is noticed and the camera reopened.
   */
  previewRef?: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Where the camera stands, for the page to show.
 * - idle: not asked for yet, or stopped
 * - live: delivering a picture
 * - reconnecting: lost, and being reopened
 * - denied: the browser or the candidate blocked it; needs the site permission changed
 * - unavailable: could not be opened (in use by another app, unplugged, a driver problem)
 */
export type CameraState = 'idle' | 'live' | 'reconnecting' | 'denied' | 'unavailable';

/**
 * Stands in for a chunk that is already stored elsewhere.
 *
 * A recording is now one file for the whole interview, and its chunks are kept
 * in the browser's database as they arrive. Holding them here as well put an
 * hour of video in memory twice. The list's *length* is what the rest of this
 * hook reads — whether any data has arrived — so it still gets one entry per
 * chunk, just not the bytes.
 */
const EMPTY_BLOB = new Blob([]);

/** Fresh recorders attempted before giving up on a camera that delivers nothing (the automatic no-footage check). */
const MAX_RESTARTS = 2;

/** How long a camera may show no picture (muted track, frozen preview) before it is reopened. */
const DARK_GRACE_MS = 5000;

/** How often the camera's health is checked. */
const HEALTH_CHECK_MS = 4000;

/** Attempts, with a growing pause, at reopening the camera each time it is lost. */
const REOPEN_ATTEMPTS = 3;

const isPermissionError = (err: unknown) =>
  err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');

const describe = (err: unknown) => (err instanceof DOMException ? `${err.name}: ${err.message}` : String(err));

export function useMediaRecorder(options?: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /** Bumped when the stream is swapped, so a preview bound to `stream` re-renders. */
  const [, setStreamVersion] = useState(0);
  const constraintsRef = useRef<MediaStreamConstraints>({ audio: true, video: true });
  const restartsRef = useRef(0);
  const watchdogRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);
  /** Whether the camera has been asked for (start called) and not stopped: only then is it kept alive. */
  const wantedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const darkTimerRef = useRef<number | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  /** The stored session the current recorder is writing to. */
  const sessionRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  /** Set below; a ref so the track handlers always call the current one. */
  const reconnectRef = useRef<(reason: string) => Promise<boolean>>(async () => false);

  const clearWatchdog = () => {
    if (watchdogRef.current != null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (segmentTimerRef.current != null) {
      window.clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  };

  const clearDarkTimer = () => {
    if (darkTimerRef.current != null) {
      window.clearTimeout(darkTimerRef.current);
      darkTimerRef.current = null;
    }
  };

  /**
   * Watches a stream's video track for the two ways a camera goes dark: it ends (taken by another app, unplugged, a
   * driver reset), or it stays "on" but stops sending pictures (muted), which is what a laptop waking from sleep or a
   * system restart of the camera service leaves behind. Either way it is reopened.
   */
  const watchStream = useCallback((stream: MediaStream) => {
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (streamRef.current === stream) void reconnectRef.current('The camera stopped delivering video.');
      };
      track.onmute = () => {
        clearDarkTimer();
        darkTimerRef.current = window.setTimeout(() => {
          if (streamRef.current === stream && track.muted && track.readyState === 'live') {
            void reconnectRef.current('The camera stopped sending a picture.');
          }
        }, DARK_GRACE_MS);
      };
      track.onunmute = () => clearDarkTimer();
    });
  }, []);

  /**
   * Record `stream`, and notice if it stops delivering.
   *
   * <p>A recorder whose camera is taken away does not fail: it simply never
   * produces a frame. So a recorder that has produced no data well after it
   * should have reopens the camera (a limited number of times).</p>
   */
  const attach = useCallback((stream: MediaStream) => {
    const opts = optionsRef.current;
    const mimeType = opts?.mimeType || PROCTORING_CONFIG.recording.camera.mimeType;
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
      videoBitsPerSecond: PROCTORING_CONFIG.recording.camera.videoBitsPerSecond,
      audioBitsPerSecond: PROCTORING_CONFIG.recording.camera.audioBitsPerSecond,
    });

    // A fresh session per recorder. One abandoned without footage (a camera
    // that never delivered) is dropped rather than left to be uploaded empty.
    recordingSync.discard(sessionRef.current);
    sessionRef.current = optionsRef.current?.persist
      ? recordingSync.begin(optionsRef.current.persist.scheduleId(), 'camera', recorder.mimeType || mimeType)
      : null;
    const sessionId = sessionRef.current;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        const kept = sessionId ? EMPTY_BLOB : e.data;
        chunksRef.current.push(kept);
        setChunks((prev) => [...prev, kept]);
        recordingSync.chunk(sessionId, e.data);
        optionsRef.current?.onDataAvailable?.(e.data);
      }
    };
    recorder.onstop = () => setIsRecording(false);
    recorder.onerror = () => optionsRef.current?.onProblem?.('The camera recorder reported an error.');

    recorderRef.current = recorder;
    recorder.start(optionsRef.current?.timeslice);
    setIsRecording(true);

    // Generous: the first chunk only arrives after a full timeslice. Without
    // one the whole recording is a single chunk, so there is nothing to wait for.
    const slice = optionsRef.current?.timeslice;
    clearWatchdog();
    if (slice) {
      watchdogRef.current = window.setTimeout(() => {
        if (recorderRef.current !== recorder || chunksRef.current.length > 0) return;
        if (restartsRef.current >= MAX_RESTARTS) {
          optionsRef.current?.onProblem?.('The camera produced no footage. The camera could not be recovered.');
          return;
        }
        restartsRef.current += 1;
        void reconnectRef.current('The camera produced no footage.');
      }, slice * 2 + 5000);
    }

    const segmentMs = optionsRef.current?.segmentMs;
    if (segmentMs && optionsRef.current?.persist) {
      segmentTimerRef.current = window.setInterval(() => {
        const current = recorderRef.current;
        if (stoppingRef.current || !current || current.state !== 'recording') return;
        // Nothing to close off yet: leave the recorder to carry on.
        const live = streamRef.current;
        if (!live) return;
        current.onstop = () => {
          const finished = chunksRef.current;
          chunksRef.current = [];
          setChunks([]);
          if (finished.length > 0) {
            recordingSync.submit(sessionRef.current, new Blob(finished, { type: current.mimeType || 'video/webm' }));
            sessionRef.current = null;
          }
          if (!stoppingRef.current && streamRef.current === live) attach(live);
        };
        current.stop();
      }, segmentMs);
    }
  }, []);

  /**
   * Closes off the recorder on the stream being replaced, keeping what it recorded. Returns whether recording can
   * carry on on the new stream.
   */
  const closeRecorderForSwap = useCallback((): boolean => {
    const recorder = recorderRef.current;
    if (optionsRef.current?.record === false) return false;
    clearWatchdog();
    const hasFootage = chunksRef.current.length > 0;
    if (optionsRef.current?.persist) {
      // Stored as it was recorded: the part so far is closed off and uploaded, and a new part starts.
      const session = sessionRef.current;
      sessionRef.current = null;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          if (hasFootage) recordingSync.submit(session);
          else recordingSync.discard(session);
        };
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      } else if (hasFootage) {
        recordingSync.submit(session);
      } else {
        recordingSync.discard(session);
      }
      chunksRef.current = [];
      setChunks([]);
      return true;
    }
    // Held in memory: two recordings cannot be joined into one file, so footage already recorded is kept and the
    // recording is not restarted. The camera still comes back for the preview and the face check.
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    if (hasFootage) return false;
    chunksRef.current = [];
    setChunks([]);
    return true;
  }, []);

  /**
   * Reopens the camera: after it was lost, went dark, or (from the page's "Turn camera on") was never opened. Tries a
   * few times with a growing pause, because a camera released by a sleeping system or a restarting driver is often
   * not ready at once. Says on the record what happened.
   */
  const reconnect = useCallback(async (reason: string): Promise<boolean> => {
    if (stoppingRef.current || reconnectingRef.current) return false;
    reconnectingRef.current = true;
    clearDarkTimer();
    setCameraState('reconnecting');
    try {
      const recordAgain = closeRecorderForSwap();
      streamRef.current?.getTracks().forEach((t) => t.stop());

      let fresh: MediaStream | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < REOPEN_ATTEMPTS && !fresh; attempt += 1) {
        try {
          fresh = await navigator.mediaDevices.getUserMedia(constraintsRef.current);
        } catch (err) {
          lastError = err;
          if (isPermissionError(err)) break; // waiting does not change a refusal
          await new Promise((resolve) => window.setTimeout(resolve, 1500 * (attempt + 1)));
        }
        if (stoppingRef.current) {
          fresh?.getTracks().forEach((t) => t.stop());
          return false;
        }
      }

      if (!fresh) {
        streamRef.current = null;
        setStreamVersion((v) => v + 1);
        setCameraState(isPermissionError(lastError) ? 'denied' : 'unavailable');
        optionsRef.current?.onProblem?.(`${reason} The camera could not be reopened (${describe(lastError)}).`);
        return false;
      }

      streamRef.current = fresh;
      watchStream(fresh);
      if (recordAgain && optionsRef.current?.record !== false) attach(fresh);
      setStreamVersion((v) => v + 1);
      setCameraState('live');
      optionsRef.current?.onProblem?.(
        `${reason} The camera was reconnected${recordAgain && optionsRef.current?.record !== false
          ? ' and recording continued' : ''}.`,
      );
      return true;
    } finally {
      reconnectingRef.current = false;
    }
  }, [attach, closeRecorderForSwap, watchStream]);
  reconnectRef.current = reconnect;

  const start = useCallback(async (constraints: MediaStreamConstraints = { audio: true, video: true }): Promise<MediaStream> => {
    // Kept before asking, so "Turn camera on" can ask again the same way if this first attempt fails.
    constraintsRef.current = constraints;
    wantedRef.current = true;
    stoppingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      restartsRef.current = 0;
      chunksRef.current = [];
      setChunks([]);
      watchStream(stream);
      setCameraState('live');

      // Stream only: the caller wants live frames, not a recording.
      if (optionsRef.current?.record === false) {
        recorderRef.current = null;
        setIsRecording(false);
        return stream;
      }

      // vp8 and a capped bitrate, matching the screen recorder: this is proctoring evidence of a face, and an
      // uncapped camera recording exceeded the server's upload limit on every long interview.
      attach(stream);
      return stream;
    } catch (err) {
      setCameraState(isPermissionError(err) ? 'denied' : 'unavailable');
      console.error('Failed to start recording:', err);
      throw err;
    }
  }, [attach, watchStream]);

  /** The page's "Turn camera on": opens the camera again, whatever state it is in. */
  const turnOn = useCallback(async (): Promise<boolean> => {
    wantedRef.current = true;
    stoppingRef.current = false;
    return reconnect('The camera was turned on again by the candidate.');
  }, [reconnect]);

  /**
   * Keeps the camera alive while it is wanted: a track that ended unnoticed, a preview frozen or black while the
   * camera claims to be on, and a return to the page, the network or the device (a laptop waking, Wi-Fi back, a
   * webcam plugged back in) all reopen it.
   */
  useEffect(() => {
    let lastTime = -1;
    let frozenSince = 0;

    const lost = () => {
      const stream = streamRef.current;
      const track = stream?.getVideoTracks()[0];
      return !stream || !track || track.readyState === 'ended';
    };

    const check = () => {
      if (!wantedRef.current || stoppingRef.current || reconnectingRef.current || document.hidden) return;
      if (lost()) {
        void reconnectRef.current('The camera was found switched off.');
        return;
      }
      const video = optionsRef.current?.previewRef?.current;
      if (!video || video.srcObject !== streamRef.current) {
        frozenSince = 0;
        return;
      }
      if (video.paused) void video.play().catch(() => {});
      const stalled = video.readyState < 2 || video.videoWidth === 0 || video.currentTime === lastTime;
      lastTime = video.currentTime;
      if (!stalled) {
        frozenSince = 0;
        return;
      }
      if (frozenSince === 0) frozenSince = Date.now();
      else if (Date.now() - frozenSince >= DARK_GRACE_MS) {
        frozenSince = 0;
        void reconnectRef.current('The camera picture froze.');
      }
    };

    const onReturn = () => {
      if (!wantedRef.current || stoppingRef.current) return;
      // Back from sleep, a lost connection or a hidden tab: a camera that is not delivering is reopened at once.
      if (lost() || streamRef.current?.getVideoTracks()[0]?.muted) {
        void reconnectRef.current('The camera was off after the device or connection came back.');
      }
    };
    const onVisible = () => {
      if (!document.hidden) onReturn();
    };

    // Allowed again in the browser's site settings: opened straight away, without the candidate pressing anything.
    let permission: PermissionStatus | null = null;
    const onPermission = () => {
      if (permission?.state === 'granted' && wantedRef.current && !stoppingRef.current && lost()) {
        void reconnectRef.current('Camera permission was allowed again.');
      }
    };
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((status) => {
        permission = status;
        status.addEventListener('change', onPermission);
      })
      .catch(() => {
        /* this browser cannot report the camera permission */
      });

    const timer = window.setInterval(check, HEALTH_CHECK_MS);
    window.addEventListener('online', onReturn);
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onVisible);
    navigator.mediaDevices?.addEventListener?.('devicechange', onReturn);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', onReturn);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.mediaDevices?.removeEventListener?.('devicechange', onReturn);
      permission?.removeEventListener('change', onPermission);
      clearDarkTimer();
    };
  }, []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    wantedRef.current = false;
    clearWatchdog();
    clearDarkTimer();
    // Guarded: in stream-only mode there is no recorder, and calling stop() on
    // one that never started throws.
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraState('idle');
  }, []);

  const stopAndGetBlob = useCallback(async (): Promise<Blob | null> => {
    const blob = await collectFinalBlob();
    // Handed to the background uploader rather than returned to be awaited:
    // the candidate's submission does not wait on the upload, and the upload
    // does not depend on this page staying open.
    const persist = optionsRef.current?.persist;
    if (persist) {
      recordingSync.submit(sessionRef.current, blob);
      sessionRef.current = null;
      recordingSync.finish(persist.scheduleId(), 'camera');
    }
    return blob;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collectFinalBlob = (): Promise<Blob | null> => {
    stoppingRef.current = true;
    wantedRef.current = false;
    clearWatchdog();
    clearDarkTimer();
    setCameraState('idle');
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        // Also the stream-only path, where there is no recorder at all — the
        // camera still has to be released or its light stays on after the
        // interview ends.
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const allChunks = chunksRef.current;
        resolve(
          allChunks.length > 0
            ? new Blob(allChunks, { type: recorder?.mimeType || 'video/webm' })
            : null
        );
        return;
      }

      recorder.onstop = () => {
        setIsRecording(false);
        const allChunks = chunksRef.current;
        resolve(
          allChunks.length > 0
            ? new Blob(allChunks, { type: recorder.mimeType || 'video/webm' })
            : null
        );
      };

      recorder.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    });
  };

  const getBlob = useCallback(() => {
    if (chunks.length === 0) return null;
    return new Blob(chunks, { type: recorderRef.current?.mimeType || 'video/webm' });
  }, [chunks]);

  const reset = useCallback(() => {
    setChunks([]);
    chunksRef.current = [];
  }, []);

  return {
    isRecording,
    chunks,
    start,
    stop,
    stopAndGetBlob,
    getBlob,
    reset,
    stream: streamRef.current,
    cameraState,
    turnOn,
  };
}
