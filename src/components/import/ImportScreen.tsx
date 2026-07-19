import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { addImportPreset, listImportPresets, type ImportPreset } from '../../db/repo';
import { refreshAccounts, useAccounts } from '../../hooks/useAccounts';
import { useAppStore } from '../../store/useAppStore';
import ColumnMapper from './ColumnMapper';
import ImportPreview from './ImportPreview';
import { useImport } from './useImport';

export default function ImportScreen() {
  const accounts = useAccounts();
  const symbol = useAppStore((s) => s.settings.currencySymbol);
  const imp = useImport();

  const [accountId, setAccountId] = useState<number | null>(null);
  const [presets, setPresets] = useState<ImportPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetSaved, setPresetSaved] = useState(false);

  useEffect(() => {
    void listImportPresets().then(setPresets);
  }, []);

  useEffect(() => {
    if (accountId === null && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const sample = useMemo(() => imp.map?.dataRows.slice(0, 3) ?? [], [imp.map]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await imp.loadFile(file);
  }

  async function onSavePreset() {
    if (!imp.map || presetName.trim() === '') return;
    await addImportPreset({
      name: presetName.trim(),
      mapping: imp.map.mapping,
      dateOrder: imp.map.dateOrder,
      decimal: imp.map.decimal,
      encoding: imp.map.encoding,
    });
    setPresets(await listImportPresets());
    setPresetSaved(true);
  }

  if (accounts.length === 0) {
    return (
      <section>
        <h2>Import CSV</h2>
        <p className="placeholder">Add an account first, then import a statement into it.</p>
      </section>
    );
  }

  if (imp.step === 'pick') {
    return (
      <section>
        <h2>Import CSV</h2>
        <p className="muted">
          Import a bank or e-wallet statement export. Parsing happens entirely on
          your device.
        </p>
        <label htmlFor="import-account">Import into account</label>
        <select
          id="import-account"
          value={accountId ?? ''}
          onChange={(e) => setAccountId(Number(e.target.value))}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label htmlFor="import-file">CSV file</label>
        <input id="import-file" type="file" accept=".csv,text/csv" onChange={onFile} />
      </section>
    );
  }

  if (imp.step === 'map' && imp.map) {
    return (
      <ColumnMapper
        header={imp.map.header}
        sample={sample}
        mapping={imp.map.mapping}
        dateOrder={imp.map.dateOrder}
        decimal={imp.map.decimal}
        encoding={imp.map.encoding}
        presets={presets}
        presetName={presetName}
        presetSaved={presetSaved}
        onMappingChange={imp.setMappingField}
        onDateOrderChange={(order) => imp.patchMap({ dateOrder: order })}
        onDecimalChange={(decimal) => imp.patchMap({ decimal })}
        onEncodingChange={imp.setEncoding}
        onApplyPreset={imp.applyPreset}
        onPresetNameChange={(name) => {
          setPresetName(name);
          setPresetSaved(false);
        }}
        onSavePreset={onSavePreset}
        onPreview={() => accountId !== null && imp.buildPreview(accountId)}
        onCancel={imp.reset}
      />
    );
  }

  if (imp.step === 'preview') {
    return (
      <ImportPreview
        rows={imp.preview}
        symbol={symbol}
        includedCount={imp.includedCount}
        onToggle={imp.toggleRow}
        onImport={async () => {
          if (accountId === null) return;
          await imp.runImport(accountId);
          await refreshAccounts();
        }}
        onBack={() => imp.buildPreview(accountId!)}
      />
    );
  }

  return (
    <section>
      <h2>Import complete</h2>
      <p>
        Imported {imp.result.added} transaction{imp.result.added === 1 ? '' : 's'}.
      </p>
      <button
        onClick={() => {
          imp.reset();
          setPresetName('');
          setPresetSaved(false);
        }}
      >
        Import another file
      </button>
    </section>
  );
}
