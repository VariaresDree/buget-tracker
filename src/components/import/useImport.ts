// Import pipeline state machine: pick → map → preview → done. Keeps the raw
// file bytes so encoding can be re-tried without re-selecting the file.

import { useState } from 'react';
import {
  commitImport,
  existingImportHashes,
  type ImportPreset,
} from '../../db/repo';
import { computeImportHash } from '../../lib/csv/dedupe';
import {
  detectDateOrder,
  detectHeaderRow,
  guessMapping,
  normalizeRows,
  type ColumnMapping,
  type DateOrder,
  type DecimalStyle,
  type NormalizedRow,
} from '../../lib/csv/normalize';
import { decodeBuffer, parseDelimited, type Encoding } from '../../lib/csv/parse';

export interface PreviewRow extends NormalizedRow {
  importHash: string;
  isDuplicate: boolean;
  include: boolean;
}

export type Step = 'pick' | 'map' | 'preview' | 'done';

interface MapState {
  buffer: ArrayBuffer;
  header: string[];
  dataRows: string[][];
  mapping: ColumnMapping;
  dateOrder: DateOrder;
  decimal: DecimalStyle | null;
  encoding: Encoding;
}

/** Read a File's bytes; prefers Blob.arrayBuffer, falls back to FileReader. */
function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function buildMapState(buffer: ArrayBuffer, encoding?: Encoding): MapState {
  const decoded = decodeBuffer(buffer, encoding);
  const rows = parseDelimited(decoded.text);
  const headerIndex = detectHeaderRow(rows);
  const header = rows[headerIndex] ?? [];
  const dataRows = rows.slice(headerIndex + 1);
  const mapping = guessMapping(header);
  const dateOrder =
    mapping.date !== null
      ? detectDateOrder(dataRows.map((r) => r[mapping.date!] ?? ''))
      : 'ambiguous';
  return { buffer, header, dataRows, mapping, dateOrder, decimal: null, encoding: decoded.encoding };
}

export function useImport() {
  const [step, setStep] = useState<Step>('pick');
  const [map, setMap] = useState<MapState | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState({ added: 0 });

  async function loadFile(file: File) {
    setMap(buildMapState(await readArrayBuffer(file)));
    setStep('map');
  }

  function patchMap(patch: Partial<MapState>) {
    setMap((m) => (m ? { ...m, ...patch } : m));
  }

  function setMappingField(field: keyof ColumnMapping, col: number | null) {
    setMap((m) => (m ? { ...m, mapping: { ...m.mapping, [field]: col } } : m));
  }

  function setEncoding(encoding: Encoding) {
    // Re-decode from the original bytes, preserving the user's column choices.
    setMap((m) => {
      if (!m) return m;
      const rebuilt = buildMapState(m.buffer, encoding);
      return { ...rebuilt, mapping: m.mapping, dateOrder: m.dateOrder, decimal: m.decimal };
    });
  }

  function applyPreset(preset: ImportPreset) {
    patchMap({
      mapping: preset.mapping,
      dateOrder: preset.dateOrder,
      decimal: preset.decimal,
    });
    if (preset.encoding !== map?.encoding) setEncoding(preset.encoding);
  }

  async function buildPreview(accountId: number) {
    if (!map) return;
    const normalized = normalizeRows(map.dataRows, map.mapping, {
      dateOrder: map.dateOrder,
      decimal: map.decimal ?? undefined,
    });
    const existing = await existingImportHashes(accountId);
    const seen = new Set<string>();
    const rows: PreviewRow[] = await Promise.all(
      normalized.map(async (n) => {
        if (!n.valid) return { ...n, importHash: '', isDuplicate: false, include: false };
        const importHash = await computeImportHash(accountId, n.date, n.amount, n.description);
        const isDuplicate = existing.has(importHash) || seen.has(importHash);
        seen.add(importHash);
        return { ...n, importHash, isDuplicate, include: !isDuplicate };
      }),
    );
    setPreview(rows);
    setStep('preview');
  }

  function toggleRow(index: number) {
    setPreview((rows) =>
      rows.map((r, i) => (i === index ? { ...r, include: !r.include } : r)),
    );
  }

  async function runImport(accountId: number) {
    const chosen = preview.filter((r) => r.valid && r.include);
    const added = await commitImport(
      accountId,
      chosen.map((r) => ({
        date: r.date,
        amount: r.amount,
        note: r.description,
        importHash: r.importHash,
      })),
    );
    setResult({ added });
    setStep('done');
  }

  function reset() {
    setMap(null);
    setPreview([]);
    setResult({ added: 0 });
    setStep('pick');
  }

  const includedCount = preview.filter((r) => r.valid && r.include).length;

  return {
    step, map, preview, result, includedCount,
    loadFile, patchMap, setMappingField, setEncoding, applyPreset,
    buildPreview, toggleRow, runImport, reset,
  };
}
