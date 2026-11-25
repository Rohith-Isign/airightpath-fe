import { useEffect, useRef, useState } from 'react';
import api from '@/services/api.service';
import { ENV } from '@/config/env';

/**
 * One browser tab at a time per exam.
 *
 * The same interview or assessment could be started in two browsers and run in both. The server now gives the exam to
 * one tab at a time: the page holds it by renewing a short lease every 15 seconds and gives it back when it closes. A
 * second tab is refused until the first is closed, or has stopped renewing (a crashed browser lets go within a minute).
 */

export type ExamKind = 'interview' | 'assessment';

const HEARTBEAT_MS = 15_000;

/** Whether this page load is a reload of the tab, which keeps the tab's session (and so its hold on the exam). */
const IS_RELOAD = (() => {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'reload';
  } catch {
    return false;
  }
})();

const loaded = new Map<string, string>();

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * This tab's session id for an exam. The same for the whole page load, and kept across a reload of this tab, so a
 * reload gets its own hold back at once; any other tab or browser gets a different one.
 */
export function examTabSessionId(kind: ExamKind, id: number): string {
  const key = `rp.examSession.${kind}.${id}`;
  const known = loaded.get(key);
  if (known) return known;
  let sessionId: string | null = null;
  try {
    if (IS_RELOAD) sessionId = sessionStorage.getItem(key);
  } catch {
    sessionId = null;
  }
  if (!sessionId) sessionId = newId();
  try {
    sessionStorage.setItem(key, sessionId);
  } catch {
    // Storage unavailable: the id still holds for this page load.
  }
  loaded.set(key, sessionId);
  return sessionId;
}

function paths(kind: ExamKind, id: number, sessionId: string) {
  const q = `sessionId=${encodeURIComponent(sessionId)}`;
  return kind === 'interview'
    ? { heartbeat: `/api/interview/voice/${id}/heartbeat?${q}`, release: `/api/interview/voice/${id}/release?${q}` }
    : {
        heartbeat: `/api/assessments/${id}/session/heartbeat?${q}`,
        release: `/api/assessments/${id}/session/release?${q}`,
      };
}

/** Gives the hold back, even as the tab closes (a keepalive request outlives the page). */
export function releaseExamSession(kind: ExamKind, id: number, sessionId: string): void {
  try {
    void fetch(`${ENV.API_BASE_URL}${paths(kind, id, sessionId).release}`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // The lease lapses on its own.
  }
}

/** Renews (or takes) the hold. 'held', 'blocked' with the server's message, or 'unknown' when it could not be asked. */
export async function examHeartbeat(
  kind: ExamKind,
  id: number,
  sessionId: string,
): Promise<{ result: 'held' | 'blocked' | 'unknown'; message?: string }> {
  try {
    await api.post(paths(kind, id, sessionId).heartbeat, null, { _skipErrorToast: true } as never);
    return { result: 'held' };
  } catch (err) {
    const response = (err as { response?: { status?: number; data?: { message?: string } } }).response;
    if (response?.status === 409) return { result: 'blocked', message: response.data?.message };
    return { result: 'unknown' };
  }
}

export type ExamLockStatus = 'checking' | 'held' | 'blocked';

/**
 * Holds an assessment for this tab while its exam page is open. Until the hold is confirmed the status is 'checking';
 * 'blocked' means the exam is open in another browser or tab, and the page must not run it. A server that cannot be
 * reached does not block the candidate: the hold is retried at the next beat.
 */
export function useExamSessionLock({
  kind,
  id,
  enabled = true,
}: Readonly<{ kind: ExamKind; id: number | null | undefined; enabled?: boolean }>) {
  const [status, setStatus] = useState<ExamLockStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || id == null) return;
    const sessionId = examTabSessionId(kind, id);
    sessionRef.current = sessionId;
    let stopped = false;

    const beat = async () => {
      const { result, message: why } = await examHeartbeat(kind, id, sessionId);
      if (stopped) return;
      if (result === 'blocked') {
        setStatus('blocked');
        setMessage(why ?? 'This exam is already open in another browser or tab.');
      } else if (result === 'held') {
        setStatus('held');
        setMessage(null);
      } else {
        setStatus((s) => (s === 'checking' ? 'held' : s));
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), HEARTBEAT_MS);
    const onPageHide = () => releaseExamSession(kind, id, sessionId);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      releaseExamSession(kind, id, sessionId);
    };
  }, [kind, id, enabled]);

  return { status, message, sessionId: sessionRef.current };
}
