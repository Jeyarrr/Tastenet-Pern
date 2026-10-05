import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const modalStack = [];

let previousBodyOverflow = "";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  bodyClass = "",
  variant = "",
}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      dialog = ref.current;
    if (!modalStack.length) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.getElementById("root").inert = true;
    }
    if (modalStack.length) modalStack.at(-1).inert = true;
    modalStack.push(dialog);
    dialog?.focus();
    const key = (event) => {
      if (modalStack.at(-1) !== dialog) return;
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = [
        ...dialog.querySelectorAll("button, input, select, textarea, a[href]"),
      ].filter((el) => !el.disabled && el.offsetParent !== null);
      const first = focusable[0],
        last = focusable.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      modalStack.splice(modalStack.indexOf(dialog), 1);
      if (!modalStack.length) {
        document.body.style.overflow = previousBodyOverflow;
        document.getElementById("root").inert = false;
      }
      if (modalStack.length) modalStack.at(-1).inert = false;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className={`migration-modal-overlay ${variant ? `modal-${variant}` : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`migration-modal ${wide ? "wide" : ""}`}
      >
        <header>
          <h3>{title}</h3>
          <button
            className="migration-close"
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className={`migration-modal-body ${bodyClass}`}>{children}</div>
      </section>
    </div>,
    document.getElementById("overlays"),
  );
}
