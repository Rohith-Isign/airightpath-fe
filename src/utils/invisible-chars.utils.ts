/**
 * Invisible characters: text that takes up a character but shows nothing.
 *
 * A field holding only a zero-width space looked empty, showed "1/3000", and passed every "required" check, because
 * it was not blank to the code. These are removed as they are typed or pasted, everywhere in the app (see
 * {@link installInvisibleCharGuard}), and the server removes them again from everything it receives.
 */

/**
 * Format and blank-looking characters: zero-width spaces and joiners, direction marks, the byte-order mark, soft
 * hyphens, word joiners, and the "blank" letters (Hangul fillers, the braille blank) used to fake an empty-looking
 * value. Unicode's whole Cf (format) category, plus those.
 */
const INVISIBLE = /\u034F|\u17B4|\u17B5|[\p{Cf}\u115F\u1160\u2800\u3164\uFFA0]/gu;

/** Unusual spaces (no-break, thin, ideographic and the like): shown as a space, so made an ordinary one. */
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/** Line and paragraph separators: made an ordinary line break. */
const ODD_BREAKS = /[\u2028\u2029]/g;

const isNonAscii = (ch: string) => ch.charCodeAt(0) > 0x7f;

/**
 * The text without invisible characters. The zero-width joiners (U+200C, U+200D) are kept only between two
 * non-ASCII characters, where they do real work (joined emoji, Indian-script conjuncts); anywhere else they are
 * removed with the rest.
 */
export function stripInvisible(text: string): string {
  if (!text) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\u200C' || ch === '\u200D') {
      const before = text[i - 1];
      const after = text[i + 1];
      if (before && after && isNonAscii(before) && isNonAscii(after)) out += ch;
      continue;
    }
    out += ch;
  }
  // The joiners still here are the ones kept above; Cf matches them too, so they are let through by name.
  return out
    .replace(INVISIBLE, (c) => (c === '\u200C' || c === '\u200D' ? c : ''))
    .replace(ODD_SPACES, ' ')
    .replace(ODD_BREAKS, '\n');
}

/** Whether a value is empty once invisible characters and spaces are taken out. */
export function isBlankText(text: string | null | undefined): boolean {
  return !text || stripInvisible(text).trim() === '';
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', '']);

function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has((el.getAttribute('type') ?? '').toLowerCase());
}

function clean(el: HTMLInputElement | HTMLTextAreaElement) {
  if (el.dataset.allowInvisible !== undefined) return;
  const value = el.value;
  const cleaned = stripInvisible(value);
  if (cleaned === value) return;
  // Keep the caret where the person was typing, less whatever was removed before it.
  let caret: number | null = null;
  try {
    caret = el.selectionStart == null ? null : stripInvisible(value.slice(0, el.selectionStart)).length;
  } catch {
    caret = null;
  }
  el.value = cleaned;
  if (caret != null) {
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      // A field type with no caret.
    }
  }
}

let installed = false;

/**
 * Cleans every text field in the app as it is typed into or pasted into, once, at start-up.
 *
 * <p>One listener on the document, in the capture phase, so it runs before React reads the field: React then sees
 * the cleaned value, and a keystroke that added only an invisible character changes nothing at all. It covers every
 * input and textarea, whichever component renders it, including ones added later. A field can opt out with
 * {@code data-allow-invisible}.</p>
 */
export function installInvisibleCharGuard(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'input',
    (e) => {
      // Mid-composition (an input method building a character) the text is not final; it is cleaned when it is.
      if ((e as InputEvent).isComposing || !isTextField(e.target)) return;
      clean(e.target);
    },
    true,
  );
  document.addEventListener(
    'compositionend',
    (e) => {
      if (isTextField(e.target)) clean(e.target);
    },
    true,
  );
}
