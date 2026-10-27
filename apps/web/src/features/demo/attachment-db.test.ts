import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachmentSessionId,
  getAttachment,
  putAttachment,
  removeAttachment,
} from './attachment-db';
import { validateFile } from './file-validation';

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  // Native blobs support structured cloning, as browser IndexedDB does.
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('File', NodeFile);
});
afterEach(() => vi.unstubAllGlobals());

describe('penyimpanan lampiran per tab', () => {
  it('menyimpan Blob sampai transaksi selesai, membaca ulang dan membatasi namespace', async () => {
    const session = attachmentSessionId();
    const file = new File(['invoice'], 'invoice.png', { type: 'image/png' });
    const ref = await putAttachment(file, 'image/png', 'demo-admin');
    expect(ref.sessionId).toBe(session);
    expect(await (await getAttachment(ref)).text()).toBe('invoice');
    expect(attachmentSessionId()).toBe(session);
    sessionStorage.setItem('stas-rg-files-session-v1', 'other-tab');
    await expect(getAttachment(ref)).rejects.toThrow(/sesi tab lain/);
    sessionStorage.setItem('stas-rg-files-session-v1', session);
    await removeAttachment(ref);
    await expect(getAttachment(ref)).rejects.toThrow(/mengunggah ulang/);
  });
  it('penyimpanan yang tidak tersedia menghasilkan error yang dapat ditindaklanjuti', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('Storage unavailable');
      },
    });
    await expect(
      putAttachment(new File(['data'], 'invoice.png'), 'image/png', 'demo-admin'),
    ).rejects.toThrow();
  });
  it('memblokir file kosong, terlalu besar dan format yang tidak sesuai', async () => {
    await expect(validateFile(new File([], 'empty.pdf'), 'invoice')).rejects.toThrow(/10 MB/);
    await expect(
      validateFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png'), 'invoice'),
    ).rejects.toThrow(/10 MB/);
    await expect(validateFile(new File(['text'], 'invoice.png'), 'invoice')).rejects.toThrow(
      /valid/,
    );
    await expect(validateFile(new File(['text'], 'source.exe'), 'rab')).rejects.toThrow(/CSV/);
  });
});
