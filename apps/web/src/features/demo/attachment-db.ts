import type { AttachmentRef } from './model';

const DATABASE = 'stas-rg-attachments-v1';
const SESSION_KEY = 'stas-rg-files-session-v1';
export function attachmentSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new Error('Penyimpanan file tidak tersedia. Izinkan penyimpanan browser lalu coba lagi.'),
      );
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error('Penyimpanan file tidak tersedia. Periksa pengaturan browser lalu coba lagi.'),
      );
    request.onblocked = () =>
      reject(new Error('Penyimpanan sedang digunakan. Tutup tab demo lain lalu coba lagi.'));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const request = work(tx.objectStore('files'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () =>
        reject(new Error('File gagal disimpan. Periksa ruang penyimpanan browser lalu coba lagi.'));
      tx.onabort = () => reject(new Error('Penyimpanan file dibatalkan. Silakan coba lagi.'));
    });
  } catch (cause) {
    if (cause instanceof DOMException)
      throw new Error(
        'File gagal disimpan. Periksa ruang dan izin penyimpanan browser lalu coba lagi.',
        { cause },
      );
    throw cause;
  } finally {
    db.close();
  }
}
function key(ref: AttachmentRef) {
  if (ref.sessionId !== attachmentSessionId())
    throw new Error('File berasal dari sesi tab lain. Unggah kembali pada tab ini.');
  return `${ref.sessionId}:${ref.id}`;
}
export async function putAttachment(
  file: File,
  mime: string,
  uploadedBy: string,
): Promise<AttachmentRef> {
  const ref: AttachmentRef = {
    id: crypto.randomUUID(),
    sessionId: attachmentSessionId(),
    name: file.name,
    mime,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  };
  await transaction('readwrite', (store) => store.put(file.slice(0, file.size, mime), key(ref)));
  return ref;
}
export async function getAttachment(ref: AttachmentRef): Promise<Blob> {
  const value: unknown = await transaction(
    'readonly',
    (store) => store.get(key(ref)) as IDBRequest<unknown>,
  );
  if (!(value instanceof Blob))
    throw new Error('File tidak tersedia di browser. Minta Admin mengunggah ulang.');
  if (value.size !== ref.size || value.type !== ref.mime)
    throw new Error('File tidak sesuai metadata. Minta Admin mengunggah ulang.');
  return value;
}
export async function removeAttachment(ref: AttachmentRef) {
  await transaction('readwrite', (store) => store.delete(key(ref)));
}
export async function fileBytes(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error('File tidak dapat dibaca.'));
    reader.onerror = () => reject(new Error('File tidak dapat dibaca. Pilih file lain.'));
    reader.readAsArrayBuffer(file);
  });
}
