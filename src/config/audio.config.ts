/**
 * How the microphone is asked for, everywhere it is opened.
 *
 * <p>Background noise reaches the interview three ways: into the transcript (a
 * fan Whisper hears as words), into the recording a reviewer listens to, and into
 * the answer the AI is judging. The browser can remove a good deal of it before
 * any of those, but only if asked — and it was asked in one place. The transcription
 * microphone requested noise suppression; the camera recording, the screen
 * recording's microphone and the chunking hook each opened a bare {@code audio: true}
 * and took whatever the device defaulted to.</p>
 */
const flag = (value: unknown, fallback: boolean) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '' ? fallback : v === 'true';
};

/**
 * The browser's (Chrome and Edge) noise suppression: on. Without it, room noise around a candidate went into the
 * transcript as words. Set VITE_MIC_NOISE_SUPPRESSION=false to turn it off.
 */
const NOISE_SUPPRESSION = flag(import.meta.env.VITE_MIC_NOISE_SUPPRESSION, true);

/**
 * Chrome's voice isolation, a much stronger filter on top of noise suppression: off. It removed noise, but it also
 * cut quiet or unclear speech it did not recognise as a voice, and a candidate speaking low lost words before the
 * speech service ever heard them. Noise suppression alone keeps the room out without that. Set
 * VITE_MIC_VOICE_ISOLATION=true to turn it on.
 */
const VOICE_ISOLATION = flag(import.meta.env.VITE_MIC_VOICE_ISOLATION, false);

export const MIC_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  // Keeps the interviewer's voice out of the answer.
  echoCancellation: true,
  noiseSuppression: NOISE_SUPPRESSION,
  // Lifts a quiet speaker to a steady level.
  autoGainControl: true,
  // One channel: speech has no use for two, and it halves what is sent and recorded.
  channelCount: 1,
  ...({ voiceIsolation: VOICE_ISOLATION } as MediaTrackConstraints),
};

export interface MicProcessingReport {
  /** What the browser reports it is actually doing to the signal. */
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  /** The microphone's name, for telling a headset from a laptop array. */
  label?: string;
  /** True when noise suppression is confirmed on. */
  suppressed: boolean;
}

/**
 * What the browser actually applied, as opposed to what was asked for.
 *
 * Constraints are requests. A browser that cannot honour one carries on without it
 * and says nothing, so "we asked for noise suppression" is not the same as "the
 * candidate's audio was cleaned" — and the first is all that could be claimed.
 */
export function micProcessingReport(stream: MediaStream | null | undefined): MicProcessingReport {
  const track = stream?.getAudioTracks()[0];
  if (!track) return { suppressed: false };
  const settings = track.getSettings?.() ?? {};
  return {
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
    label: track.label || undefined,
    suppressed: settings.noiseSuppression === true,
  };
}

/** One line for the reviewer's log. */
export function describeMicProcessing(report: MicProcessingReport): string {
  const flag = (value?: boolean) => (value === undefined ? 'not reported' : value ? 'on' : 'off');
  return (
    `Microphone${report.label ? ` "${report.label}"` : ''}: noise suppression ${flag(report.noiseSuppression)}, ` +
    `echo cancellation ${flag(report.echoCancellation)}, auto gain ${flag(report.autoGainControl)}.`
  );
}
