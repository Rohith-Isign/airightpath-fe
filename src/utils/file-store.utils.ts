/**
 * Keeps chosen files across a page refresh. A browser will not let a page hold on to a `File` it was given, but it can
 * keep a copy of the bytes in IndexedDB, which sessionStorage cannot hold.
 *
 * Every function resolves quietly on failure (private mode, a full disk, no IndexedDB): a file that could not be kept
 * only means it is not there after the refresh, which must never get in the way of choosing or removing files.
 */

const DB_NAME = 'rightpath-files';
const STORE = 'files';

interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).finally(() => db.close()),
  );
}

/** Replaces whatever is kept under `key` with `files`. An empty list removes the entry. */
export async function saveFiles(key: string, files: File[]): Promise<void> {
  try {
    if (files.length === 0) {
      await run('readwrite', (store) => store.delete(key));
      return;
    }
    const stored: StoredFile[] = files.map((f) => ({
      name: f.name,
      type: f.type,
      lastModified: f.lastModified,
      blob: f,
    }));
    await run('readwrite', (store) => store.put(stored, key));
  } catch {
    // Not kept; see the note at the top.
  }
}

/** The files kept under `key`, or an empty list. */
export async function loadFiles(key: string): Promise<File[]> {
  try {
    const stored = await run<StoredFile[] | undefined>('readonly', (store) => store.get(key));
    return (stored ?? []).map((s) => new File([s.blob], s.name, { type: s.type, lastModified: s.lastModified }));
  } catch {
    return [];
  }
}

export function clearFiles(key: string): Promise<void> {
  return saveFiles(key, []);
}
