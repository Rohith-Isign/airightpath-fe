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
/**
 * Whether the browser's own noise suppression (and Chrome's voice isolation) is applied. Off by default.
 *
 * It was on, and it cut speech it took for noise: a quiet or unclear voice lost syllables and whole words before the
 * speech service ever heard it, and answers came back short or empty. The speech service copes with room noise far
 * better than with clipped speech, so it now gets the voice as the microphone heard it. Echo cancellation and
 * automatic gain stay: the first keeps the interviewer's voice out, the second lifts a quiet speaker. Set
 * VITE_MIC_NOISE_SUPPRESSION=true to turn suppression back on.
 */
const NOISE_SUPPRESSION = String(import.meta.env.VITE_MIC_NOISE_SUPPRESSION ?? '').trim().toLowerCase() === 'true';

export const MIC_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: NOISE_SUPPRESSION,
  autoGainControl: true,
  // One channel: speech has no use for two, and it halves what is sent and recorded.
  channelCount: 1,
  // Chrome's voice isolation goes with noise suppression: asked for only when that is on.
  ...({ voiceIsolation: NOISE_SUPPRESSION } as MediaTrackConstraints),
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
