import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { validateFile } from './file-validation';

async function document(kind: 'xlsx' | 'docx', macro = false) {
  const archive = new JSZip();
  const content =
    kind === 'xlsx' ? 'spreadsheetml.sheet.main+xml' : 'wordprocessingml.document.main+xml';
  archive.file(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${kind === 'xlsx' ? 'xl/workbook.xml' : 'word/document.xml'}" ContentType="application/vnd.openxmlformats-officedocument.${content}"/></Types>`,
  );
  archive.file(
    kind === 'xlsx' ? 'xl/workbook.xml' : 'word/document.xml',
    kind === 'xlsx'
      ? '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'
      : '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
  );
  if (macro) archive.file('word/vbaProject.bin', 'macro');
  return new File(
    [new Uint8Array(await archive.generateAsync({ type: 'arraybuffer' }))],
    `invoice.${kind}`,
  );
}
describe('Office invoice validation', () => {
  it.each(['xlsx', 'docx'] as const)(
    'accepts %s and rejects wrong extensions and macro packages',
    async (kind) => {
      const valid = await document(kind);
      expect(await validateFile(valid, 'invoice')).toContain('openxmlformats');
      await expect(
        validateFile(new File([valid], `invoice.${kind === 'xlsx' ? 'docx' : 'xlsx'}`), 'invoice'),
      ).rejects.toThrow(/Office/);
      await expect(validateFile(await document(kind, true), 'invoice')).rejects.toThrow(/Office/);
    },
  );
  it('rejects damaged, empty and oversized documents', async () => {
    for (const file of [
      new File([], 'invoice.docx'),
      new File(['PK-invalid'], 'invoice.xlsx'),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'invoice.docx'),
    ])
      await expect(validateFile(file, 'invoice')).rejects.toThrow();
  });
});
