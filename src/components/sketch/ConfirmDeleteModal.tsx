'use client';

import { SketchButton } from './SketchButton';
import { SketchModal } from './SketchModal';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<unknown>;
  title?: string;
  itemDescription?: string;
  pending?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'CONFIRMAR EXCLUSÃO',
  itemDescription,
  pending = false,
}: ConfirmDeleteModalProps) {
  return (
    <SketchModal isOpen={isOpen} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onConfirm();
        }}
        className="space-y-4"
      >
        <p className="text-sm tracking-wide">
          {itemDescription ? (
            <>
              TEM CERTEZA QUE DESEJA EXCLUIR{' '}
              <strong className="text-[#f1f3f5]">{itemDescription}</strong>?
            </>
          ) : (
            'TEM CERTEZA QUE DESEJA EXCLUIR ESTE REGISTRO?'
          )}
        </p>
        <div className="flex items-center justify-end gap-3">
          <SketchButton
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            CANCELAR
          </SketchButton>
          <SketchButton
            type="submit"
            variant="filled"
            disabled={pending}
            className="border-[#ffc9c9] bg-[#ffc9c9] text-[#121212] hover:bg-[#ffc9c9]/90"
          >
            {pending ? 'EXCLUINDO...' : 'SIM, EXCLUIR'}
          </SketchButton>
        </div>
      </form>
    </SketchModal>
  );
}
