/**
 * Where to go after signing in, kept across the sign-in.
 *
 * A candidate opening a shared apply link while signed out was sent to sign in and then landed on their dashboard,
 * not on the job. The address was only carried in the router's state, which is lost when they go on to register
 * first, and the sign-in page's own redirect raced the redirect that sends any signed-in user to their dashboard.
 * Kept here instead, for this tab, for half an hour, and used by every page that sends someone on after sign-in.
 */
const KEY = 'rp.postLoginRedirect';
const TTL_MS = 30 * 60 * 1000;

/** Remembers the page someone was trying to open when they were asked to sign in. */
export function rememberPostLoginRedirect(path: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage unavailable (private mode): the router state still carries it for a direct sign-in.
  }
}

/** The remembered page, if there is one and it is recent. Does not clear it. */
export function peekPostLoginRedirect(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    if (!path || !at || Date.now() - at > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

/** Forgets the remembered page, once the signed-in user has been taken somewhere. */
export function clearPostLoginRedirect(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
