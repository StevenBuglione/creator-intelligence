"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

type Ask = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  /** When set, the owner must type this phrase exactly before confirming. */
  phrase?: string;
};
type Pending = Ask & { resolve: (value: string | null) => void };

/**
 * Native modal confirmation. Resolves to the confirmation (the typed phrase,
 * or "confirmed") or null when the owner cancels or presses Escape.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = useCallback(
    (options: Ask) =>
      new Promise<string | null>((resolve) =>
        setPending({ ...options, resolve }),
      ),
    [],
  );
  const element = pending ? (
    <ConfirmDialog
      key={pending.title}
      {...pending}
      onClose={(value) => {
        pending.resolve(value);
        setPending(null);
      }}
    />
  ) : null;
  return [element, ask] as const;
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = "default",
  phrase,
  onClose,
}: Ask & { onClose: (value: string | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const ready = !phrase || typed === phrase;
  return (
    <dialog
      ref={ref}
      className={"dialog dialog-" + tone}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose(null);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(null);
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onClose(phrase ? typed : "confirmed");
        }}
      >
        <header>
          <span className="dialog-icon" aria-hidden="true">
            <Icon name={tone === "danger" ? "alert" : "shield"} size={20} />
          </span>
          <h2 id="dialog-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cancel"
            onClick={() => onClose(null)}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="dialog-body">{body}</div>
        {phrase && (
          <label className="field">
            <span className="field-label">
              Type <code>{phrase}</code> to confirm
            </span>
            <input
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
        )}
        <footer>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => onClose(null)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={
              "btn " + (tone === "danger" ? "btn-danger" : "btn-primary")
            }
            disabled={!ready}
            autoFocus={!phrase}
          >
            {confirmLabel}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
