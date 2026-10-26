import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const requireFromWeb = createRequire(resolve(process.cwd(), 'package.json'));
const requireFromProvider = createRequire(requireFromWeb.resolve('@refinedev/simple-rest'));
const queryString = requireFromProvider('query-string') as {
  parse: (value: string) => Record<string, unknown>;
  stringify: (value: Record<string, string>) => string;
};

describe('kompatibilitas decoder perbaikan keamanan', () => {
  it('mempertahankan serialisasi dan parsing parameter provider REST', () => {
    const values = { q: 'barang / listrik', jenis: 'STAS-RG' };
    expect(queryString.parse(queryString.stringify(values))).toEqual(values);
  });
  it('menangani percent encoding rusak tanpa memutus parser', () => {
    expect(() => queryString.parse('q=%E0%A4%A')).not.toThrow();
  });
});
