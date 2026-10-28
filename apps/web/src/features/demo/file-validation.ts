import { fileBytes } from './attachment-db';

export async function validateFile(file: File, purpose: 'invoice' | 'rab') {
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error('Pilih file berisi data dengan ukuran maksimal 10 MB.');
  const ext = file.name.toLowerCase().split('.').at(-1);
  const bytes = new Uint8Array(await fileBytes(file.slice(0, 1024)));
  const header = new TextDecoder().decode(bytes);
  let mime = '';
  if (purpose === 'invoice' && (ext === 'xlsx' || ext === 'docx')) {
    const { validateOffice } = await import('./office-validation');
    return validateOffice(file, ext);
  }
  if (ext === 'pdf' && header.startsWith('%PDF-')) mime = 'application/pdf';
  if (purpose === 'invoice') {
    if (ext === 'png' && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)
      mime = 'image/png';
    if (
      ['jpg', 'jpeg'].includes(ext ?? '') &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    )
      mime = 'image/jpeg';
    if (ext === 'webp' && header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP')
      mime = 'image/webp';
  } else {
    if (ext === 'csv' && !bytes.includes(0)) mime = 'text/csv';
    if (ext === 'xlsx' && header.startsWith('PK'))
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (!mime)
    throw new Error(
      purpose === 'invoice'
        ? 'Gunakan file PDF, XLSX, DOCX, PNG, JPEG, atau WebP yang valid.'
        : 'Gunakan file CSV, XLSX, atau PDF yang valid.',
    );
  if (mime === 'application/pdf') {
    try {
      const { openPdf } = await import('./pdf-loader');
      const document = await openPdf(file);
      await document.getPage(1);
      await document.loadingTask.destroy();
    } catch {
      throw new Error('PDF tidak dapat dibuka. Gunakan file yang tidak rusak dan tanpa sandi.');
    }
  }
  if (mime.startsWith('image/') && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
    } catch {
      throw new Error('Gambar tidak dapat dibuka. Pilih file gambar lain.');
    }
  }
  return mime;
}
