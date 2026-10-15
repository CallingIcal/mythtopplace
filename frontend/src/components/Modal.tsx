import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Dialog di dalam halaman (portal ke body). Tidak memakai window.confirm yang diblokir di banyak lingkungan tertanam. */
export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body,
  );
}

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm, className = 'btn ghost sm' }: {
  label: string; title: string; message: string; confirmLabel: string; onConfirm: () => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Modal label={title} onClose={() => setOpen(false)}>
          <h3>{title}</h3>
          <p>{message}</p>
          <div className="row">
            <button className="btn" onClick={() => { setOpen(false); onConfirm(); }}>{confirmLabel}</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Batal</button>
          </div>
        </Modal>
      )}
    </>
  );
}
