import { extractApiError } from '@/services/api.service';

/**
 * Sending a piece of a recording straight to storage, on a URL the server signs
 * for it, so the video does not pass through the application server.
 *
 * <p>Where that does not work (the bucket does not allow this site, or the
 * server is too old to sign URLs) the piece goes through the server as before,
 * and so do the rest for as long as the page is open.</p>
 */

const PUT_TIMEOUT_MS = 5 * 60 * 1000;

let directBlocked = false;

async function putToStorage(url: string, piece: Blob): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUT_TIMEOUT_MS);
  try {
    // No credentials and no headers of our own: the URL carries the permission.
    const res = await fetch(url, { method: 'PUT', body: piece, credentials: 'omit', signal: controller.signal });
    if (!res.ok) throw new Error(`Storage answered ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One attempt at one piece. Retrying is the caller's business.
 *
 * @param requestUrl asks the server for a URL for this piece
 * @param viaServer  sends the piece through the server instead
 */
export async function sendRecordingPiece(
  piece: Blob,
  requestUrl: () => Promise<string>,
  viaServer: () => Promise<unknown>,
): Promise<void> {
  if (!directBlocked) {
    try {
      const url = await requestUrl();
      try {
        await putToStorage(url, piece);
        return;
      } catch (err) {
        console.warn('Direct upload to storage failed; sending through the server:', err);
      }
    } catch (err) {
      // A refusal such as 410 is the server's answer about this upload and stands.
      const status = extractApiError(err).status;
      if (status !== 404 && status !== 405) throw err;
    }
  }
  await viaServer();
  // Only once the server route has worked: if both fail the connection is the
  // likelier cause, and the direct route is worth trying again.
  directBlocked = true;
}
