import { fileBytes } from './attachment-db';

export async function validateOffice(file: File, kind: 'xlsx' | 'docx') {
  try {
    const bytes = await fileBytes(file);
    const view = new DataView(bytes);
    let end = view.byteLength - 22;
    const minimum = Math.max(0, end - 65535);
    while (end >= minimum && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < minimum) throw new Error('ZIP directory missing');
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    let expanded = 0;
    if (!count || count > 2000) throw new Error('Archive too large');
    for (let index = 0; index < count; index++) {
      if (view.getUint32(offset, true) !== 0x02014b50 || view.getUint16(offset + 8, true) & 1)
        throw new Error('Invalid or encrypted archive');
      const size = view.getUint32(offset + 24, true);
      expanded += size;
      if (expanded > 50 * 1024 * 1024 || size > 20 * 1024 * 1024)
        throw new Error('Expanded document too large');
      offset +=
        46 +
        view.getUint16(offset + 28, true) +
        view.getUint16(offset + 30, true) +
        view.getUint16(offset + 32, true);
    }
    const { default: JSZip } = await import('jszip');
    const archive = await JSZip.loadAsync(bytes);
    if (Object.keys(archive.files).some((name) => /vbaProject|macros/i.test(name)))
      throw new Error('Macros unsupported');
    const types = archive.file('[Content_Types].xml');
    const main = archive.file(kind === 'xlsx' ? 'xl/workbook.xml' : 'word/document.xml');
    if (!types || !main) throw new Error('Wrong document type');
    const xml = await types.async('string');
    const content = await main.async('string');
    for (const text of [xml, content]) {
      if (
        new DOMParser().parseFromString(text, 'application/xml').getElementsByTagName('parsererror')
          .length
      )
        throw new Error('Invalid XML');
    }
    const expected =
      kind === 'xlsx' ? 'spreadsheetml.sheet.main+xml' : 'wordprocessingml.document.main+xml';
    if (
      !xml.includes(expected) ||
      /macroEnabled/i.test(xml) ||
      new DOMParser().parseFromString(content, 'application/xml').documentElement.localName !==
        (kind === 'xlsx' ? 'workbook' : 'document')
    )
      throw new Error('Invalid Office document');
    return kind === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } catch {
    throw new Error(
      'Dokumen Office tidak valid. Gunakan XLSX atau DOCX yang tidak rusak, tanpa sandi dan tanpa makro.',
    );
  }
}
