'use client';

import { useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  perigoso?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({
  open,
  titulo,
  descricao,
  rotuloConfirmar = 'Confirmar',
  perigoso = true,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const handleClose = () => {
      const val = dlg.returnValue;
      dlg.returnValue = '';
      if (val === 'confirm') {
        onConfirmar();
      } else {
        onCancelar();
      }
    };
    dlg.addEventListener('close', handleClose);
    return () => dlg.removeEventListener('close', handleClose);
  }, [onConfirmar, onCancelar]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="w-full max-w-md rounded-[14px] border border-[#dde3ec] bg-white p-6 text-[#151a22] shadow-xl"
    >
      <h1 id={titleId} className="text-lg font-bold text-[#151a22]">
        {titulo}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#5f6b7e]">{descricao}</p>
      <form method="dialog" className="mt-6 flex justify-end gap-2.5">
        <button
          value="cancel"
          autoFocus
          className="rounded-[10px] border border-[#dde3ec] bg-white px-4 py-2 text-sm font-medium text-[#151a22] hover:bg-[#eef1f7] cursor-pointer"
        >
          Cancelar
        </button>
        <button
          value="confirm"
          className={`rounded-[10px] px-4 py-2 text-sm font-semibold text-white cursor-pointer ${
            perigoso ? 'bg-[#c62828] hover:bg-red-800' : 'bg-[#1f5fe0] hover:bg-[#164bb5]'
          }`}
        >
          {rotuloConfirmar}
        </button>
      </form>
    </dialog>
  );
}
