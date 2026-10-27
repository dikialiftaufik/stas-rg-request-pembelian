import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { fileBytes } from './attachment-db';

export async function openPdf(file: Blob) {
  const pdf = await import('pdfjs-dist');
  pdf.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdf.getDocument({ data: new Uint8Array(await fileBytes(file)) }).promise;
}
