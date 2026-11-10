'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SketchModal } from '@/components/sketch/SketchModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import type { AcademicProjectView, ProjectLinkInput } from '../service';
import { createProjectAction, updateProjectAction } from '../actions';

export interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProject?: AcademicProjectView | null;
}

const inputClass =
  'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none';

export function ProjectFormModal({
  isOpen,
  onClose,
  initialProject,
}: ProjectFormModalProps) {
  const isEditing = Boolean(initialProject);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [finalDeliveryDate, setFinalDeliveryDate] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [links, setLinks] = useState<ProjectLinkInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialProject) {
      setTitle(initialProject.title);
      setDescription(initialProject.description);
      setFinalDeliveryDate(initialProject.finalDeliveryDate ?? '');
      setGroupInput(initialProject.groupMembersList.join(', '));
      setLinks(initialProject.links.map((l) => ({ id: l.id, label: l.label, url: l.url })));
    } else {
      setTitle('');
      setDescription('');
      setFinalDeliveryDate('');
      setGroupInput('');
      setLinks([]);
    }
    setError(null);
  }, [isOpen, initialProject]);

  function handleAddLink() {
    setLinks((prev) => [...prev, { label: '', url: '' }]);
  }

  function handleUpdateLink(index: number, field: 'label' | 'url', val: string) {
    setLinks((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)));
  }

  function handleRemoveLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('TÍTULO E DESCRIÇÃO SÃO OBRIGATÓRIOS.');
      return;
    }

    const groupMembers = groupInput.split(',').map((m) => m.trim()).filter(Boolean);
    const validLinks = links.filter((l) => l.label.trim() && l.url.trim());
    setSaving(true);
    setError(null);

    const payload = {
      title,
      description,
      finalDeliveryDate: finalDeliveryDate.trim() || null,
      groupMembers,
      links: validLinks,
    };
    const result = initialProject
      ? await updateProjectAction(initialProject.id, payload)
      : await createProjectAction(payload);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'ERRO AO SALVAR PROJETO.');
      return;
    }
    onClose();
  }

  return (
    <SketchModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'EDITAR PROJETO' : 'NOVO PROJETO'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="p-title" className="mb-1 block text-xs">TÍTULO DO PROJETO</label>
          <input
            id="p-title"
            placeholder="EX: TCC, COMPILADORES, SISTEMAS DISTRIBUÍDOS"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="p-desc" className="mb-1 block text-xs">DESCRIÇÃO CURTA</label>
          <textarea
            id="p-desc"
            rows={2}
            placeholder="EX: DESENVOLVIMENTO DE PROTÓTIPO EM NEXT.JS E IA"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="p-date" className="mb-1 block text-xs">DATA DA ENTREGA FINAL</label>
            <input
              id="p-date"
              type="date"
              value={finalDeliveryDate}
              onChange={(e) => setFinalDeliveryDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="p-group" className="mb-1 block text-xs">INTEGRANTES DO GRUPO (SEPARADOS POR VÍRGULA)</label>
            <input
              id="p-group"
              placeholder="EX: XAVIER, LETICIA, CAIO"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-[#f1f3f5]/20 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs">LINKS CUSTOMIZÁVEIS (GITHUB, DRIVE, FIGMA...)</span>
            <button
              type="button"
              onClick={handleAddLink}
              className="text-[10px] text-[#f1f3f5] underline hover:opacity-80"
            >
              + ADICIONAR LINK
            </button>
          </div>

          {links.map((link, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                placeholder="RÓTULO (EX: GITHUB)"
                value={link.label}
                onChange={(e) => handleUpdateLink(idx, 'label', e.target.value)}
                className="w-1/3 rounded border border-[#f1f3f5] bg-[#121212] px-2 py-1 text-xs text-[#f1f3f5] focus:outline-none"
              />
              <input
                placeholder="URL (EX: HTTPS://...)"
                value={link.url}
                onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                className="flex-1 rounded border border-[#f1f3f5] bg-[#121212] px-2 py-1 text-xs text-[#f1f3f5] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRemoveLink(idx)}
                className="text-xs text-[#868e96] hover:text-[#f1f3f5] px-1"
              >
                X
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="rounded border border-dashed border-[#f1f3f5] p-2 text-xs text-[#f1f3f5]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f3f5]/20">
          <SketchButton type="button" variant="ghost" disabled={saving} onClick={onClose}>
            CANCELAR
          </SketchButton>
          <SketchButton type="submit" variant="filled" disabled={saving}>
            {saving ? 'SALVANDO...' : 'SALVAR'}
          </SketchButton>
        </div>
      </form>
    </SketchModal>
  );
}
