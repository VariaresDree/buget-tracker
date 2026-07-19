// Local-only CSV decoding + delimiting. Papaparse is fed strings we already
// hold in memory — never a URL — so import parsing makes no network request
// (CLAUDE.md guardrail).

import Papa from 'papaparse';

export type Encoding = 'utf-8' | 'windows-1252';

export interface Decoded {
  text: string;
  encoding: Encoding;
}

/** Decode file bytes, trying strict UTF-8 first, then windows-1252. */
export function decodeBuffer(buffer: ArrayBuffer, override?: Encoding): Decoded {
  const stripBom = (t: string) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);

  if (override) {
    return { text: stripBom(new TextDecoder(override).decode(buffer)), encoding: override };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { text: stripBom(text), encoding: 'utf-8' };
  } catch {
    return {
      text: stripBom(new TextDecoder('windows-1252').decode(buffer)),
      encoding: 'windows-1252',
    };
  }
}

/** Parse delimited text into a trimmed string matrix (delimiter auto-detected). */
export function parseDelimited(text: string): string[][] {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    delimiter: '', // auto-detect (comma, semicolon, tab, pipe)
  });
  return result.data.map((row) => row.map((cell) => (cell ?? '').trim()));
}
