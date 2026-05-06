import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import Papa from 'papaparse';
import { useCostModelStore } from '../../store/costModelStore';
import { Tooltip, InfoIcon } from '../ui/Tooltip';
import type { SupplierPriceEntry } from '../../../../shared/types';

const TEMPLATE_CSV = `date,price\n2024-01,1050\n2024-04,1080\n2024-07,1120\n2024-10,1090\n2025-01,1140`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'supplier_prices_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function SupplierPriceInput() {
  const { t } = useTranslation();
  const { supplierPrices, addSupplierPrice, removeSupplierPrice, clearSupplierPrices, setSupplierPrices } =
    useCostModelStore();

  const [newDate, setNewDate] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const price = parseFloat(newPrice);
    if (!newDate || isNaN(price) || price <= 0) return;
    // Normalize date to yyyy-MM
    const normalized = newDate.length === 7 ? newDate : newDate.substring(0, 7);
    addSupplierPrice({ date: normalized, price });
    setNewDate('');
    setNewPrice('');
  };

  const handleCSVImport = (file: File) => {
    setCsvError(null);
    setCsvSuccess(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as Record<string, string>[];
        const parsed: SupplierPriceEntry[] = [];
        const errors: string[] = [];

        rows.forEach((row, i) => {
          const dateRaw = (row['date'] || '').trim();
          const priceRaw = (row['price'] || '').trim();
          const price = parseFloat(priceRaw);

          if (!dateRaw || isNaN(price) || price <= 0) {
            errors.push(`${t('supplier.csvRowError')} ${i + 2}`);
            return;
          }
          // Accept yyyy-MM-dd or yyyy-MM
          const normalized = dateRaw.length >= 7 ? dateRaw.substring(0, 7) : null;
          if (!normalized) {
            errors.push(`${t('supplier.csvDateError')} ${i + 2}: "${dateRaw}"`);
            return;
          }
          parsed.push({ date: normalized, price });
        });

        if (errors.length > 0) {
          setCsvError(errors.slice(0, 3).join(' · '));
          return;
        }
        if (parsed.length === 0) {
          setCsvError(t('supplier.csvEmpty'));
          return;
        }

        setSupplierPrices(parsed);
        setCsvSuccess(true);
        setTimeout(() => setCsvSuccess(false), 3000);
        if (fileRef.current) fileRef.current.value = '';
      },
      error: () => setCsvError(t('supplier.csvParseError')),
    });
  };

  return (
    <div className="space-y-4 p-4">
      {/* Add single entry */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className="text-sm text-slate-400 font-medium">{t('supplier.addEntry')}</label>
          <Tooltip content={t('tooltip.supplierPrice')} side="top">
            <InfoIcon />
          </Tooltip>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-base flex-1"
            placeholder="yyyy-MM"
          />
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">€</span>
            <input
              type="number"
              min={0}
              step={1}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={t('supplier.placeholder')}
              className="input-base pl-7"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newDate || !newPrice}
            className="btn-primary px-3 flex-shrink-0 text-sm"
          >
            {t('supplier.add')}
          </button>
        </div>
      </div>

      {/* Entries list */}
      {supplierPrices.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              {t('supplier.entries')} ({supplierPrices.length})
            </p>
            <button
              onClick={clearSupplierPrices}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors"
            >
              {t('supplier.clearAll')}
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {supplierPrices.map((e) => (
              <div
                key={e.date}
                className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-1.5 text-sm"
              >
                <span className="text-slate-400 tabular-nums">{e.date}</span>
                <div className="flex items-center gap-3">
                  <span className="text-pink-400 font-medium tabular-nums">€{e.price.toFixed(0)}</span>
                  <button
                    onClick={() => removeSupplierPrice(e.date)}
                    className="text-slate-600 hover:text-red-400 transition-colors text-xs"
                    title={t('supplier.remove')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-800" />
        <span className="text-xs text-slate-600">{t('supplier.or')}</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      {/* CSV import */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className="text-sm text-slate-400 font-medium">{t('supplier.importTitle')}</label>
          <Tooltip content={t('tooltip.csvImport')} side="top">
            <InfoIcon />
          </Tooltip>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => fileRef.current?.click()}
            className={clsx(
              'btn-primary text-sm flex items-center gap-2',
              csvSuccess && 'bg-emerald-600 hover:bg-emerald-500'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {csvSuccess ? `✓ ${t('supplier.importSuccess')}` : t('supplier.importBtn')}
          </button>
          <button
            onClick={downloadTemplate}
            className="btn-ghost text-sm flex items-center gap-1.5 border border-slate-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('supplier.downloadTemplate')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCSVImport(file);
            }}
          />
        </div>

        {csvError && (
          <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 text-xs text-red-400">
            ⚠ {csvError}
          </div>
        )}

        <p className="text-[11px] text-slate-600 mt-2">
          {t('supplier.csvFormat')}: <code className="text-slate-500">date,price</code> · date: <code className="text-slate-500">yyyy-MM</code>
        </p>
      </div>
    </div>
  );
}
