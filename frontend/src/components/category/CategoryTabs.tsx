import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useCategoryStore } from '../../store/categoryStore';
import { CreateCategoryModal } from './CreateCategoryModal';

export function CategoryTabs() {
  const { t } = useTranslation();
  const { categories, activeCategoryId, setActiveCategory, renameCategory, removeCategory } =
    useCategoryStore();
  const [showModal, setShowModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
    // focus after render
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      renameCategory(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-1">
        {categories.map((cat) => {
          const isActive = cat.id === activeCategoryId;
          const isRenaming = renamingId === cat.id;

          return (
            <div
              key={cat.id}
              className={clsx(
                'group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer select-none flex-shrink-0',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-2 text-fg-soft hover:bg-border hover:text-fg'
              )}
              onClick={() => !isRenaming && setActiveCategory(cat.id)}
              onDoubleClick={() => startRename(cat.id, cat.name)}
              title={t('category.doubleClickRename')}
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent outline-none border-b border-white/60 w-24 text-sm"
                />
              ) : (
                <span className="max-w-[120px] truncate">{cat.name}</span>
              )}

              {/* Remove button — only on hover for non-active, always for active when >1 */}
              {categories.length > 1 && !isRenaming && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCategory(cat.id);
                  }}
                  className={clsx(
                    'opacity-0 group-hover:opacity-100 transition-opacity rounded w-4 h-4 flex items-center justify-center text-[10px] leading-none',
                    isActive ? 'hover:bg-white/20' : 'hover:bg-surface text-fg-muted'
                  )}
                  title={t('category.remove')}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {/* Add tab */}
        <button
          onClick={() => setShowModal(true)}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm
                     text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          title={t('category.new')}
        >
          <span className="text-base leading-none">+</span>
        </button>
      </div>

      {showModal && <CreateCategoryModal onClose={() => setShowModal(false)} />}
    </>
  );
}
