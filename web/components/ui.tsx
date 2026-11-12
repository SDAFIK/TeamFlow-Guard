"use client";
import { useEffect, useRef } from "react";
import { ShieldCheck, X, LoaderCircle } from "lucide-react";
import { GuardMark } from "./brand-motion";

export const statusLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <GuardMark size={36}/>
      </span>
      <span>
        TeamFlow<span className="brand-guard">Guard</span>
      </span>
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={`status ${value}`}>
      <i />
      {statusLabels[value] ?? value}
    </span>
  );
}
export function Busy({ text = "Working…" }: { text?: string }) {
  return (
    <span className="busy-label" role="status">
      <LoaderCircle size={16} className="spin" />
      {text}
    </span>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide-dialog" : ""}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <span className="eyebrow">TEAMFLOW GUARD</span>
          <h2 id="modal-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ShieldCheck size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
