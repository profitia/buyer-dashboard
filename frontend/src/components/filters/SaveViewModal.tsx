import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMacroFilterStore } from '../../store/macroFilterStore';

export function SaveViewModal() {
  const { t } = useTranslation();
  const { saveModalOpen, closeSaveModal, saveView } = useMacroFilterStore();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!saveModalOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await saveView(name.trim());
    setSaving(false);
    setName('');
    closeSaveModal();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => { setName(''); closeSaveModal(); }}
      />

      {/* Modal */}
      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-surface border border-border rounded-xl shadow-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-fg">{t('filter.saveViewTitle')}</h3>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
          placeholder={t('filter.saveViewPlaceholder')}
          className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-surface-2 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setName(''); closeSaveModal(); }}
            className="text-sm px-3 py-1.5 rounded-lg border border-border text-fg-muted hover:text-fg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!name.trim() || saving}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {saving ? '…' : t('filter.saveViewBtn')}
          </button>
        </div>
      </div>
    </>
  );
}
