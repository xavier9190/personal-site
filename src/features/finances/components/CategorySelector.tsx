'use client';

import { useState } from 'react';
import { SketchButton } from '@/components/sketch/SketchButton';
import { PRESET_TRANSACTION_CATEGORIES } from '../types';

export interface CategorySelectorProps {
  value: string;
  onChange: (category: string) => void;
  availableCategories?: readonly string[];
}

export function CategorySelector({
  value,
  onChange,
  availableCategories = PRESET_TRANSACTION_CATEGORIES,
}: CategorySelectorProps) {
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const options = Array.from(
    new Set([
      ...availableCategories,
      ...customCategories,
      ...(value.trim() ? [value.trim().toUpperCase()] : []),
    ]),
  );

  function handleConfirmNewCategory() {
    const formatted = newCategoryName.trim().toUpperCase();
    if (!formatted) return;
    setCustomCategories((prev) =>
      prev.includes(formatted) ? prev : [...prev, formatted],
    );
    onChange(formatted);
    setNewCategoryName('');
    setCreating(false);
  }

  return (
    <div className="space-y-2">
      <label htmlFor="tx-category" className="mb-1 block text-xs">
        CATEGORIA
      </label>

      {!creating ? (
        <div className="flex items-center gap-2">
          <select
            id="tx-category"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] uppercase focus:outline-none"
          >
            {options.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <SketchButton
            type="button"
            variant="outline"
            onClick={() => setCreating(true)}
            className="min-h-[38px] shrink-0 px-3 py-1.5 text-xs"
          >
            + CRIAR CATEGORIA
          </SketchButton>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            id="tx-category"
            type="text"
            autoFocus
            placeholder="NOME DA NOVA CATEGORIA..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmNewCategory();
              }
            }}
            className="flex-1 rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] uppercase focus:outline-none"
          />

          <SketchButton
            type="button"
            variant="filled"
            onClick={handleConfirmNewCategory}
            className="min-h-[38px] shrink-0 px-3 py-1.5 text-xs"
          >
            ADICIONAR
          </SketchButton>

          <SketchButton
            type="button"
            variant="ghost"
            onClick={() => {
              setCreating(false);
              setNewCategoryName('');
            }}
            className="min-h-[38px] shrink-0 px-2 py-1.5 text-xs"
          >
            VOLTAR
          </SketchButton>
        </div>
      )}
    </div>
  );
}
