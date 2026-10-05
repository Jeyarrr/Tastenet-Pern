import { uploadFile } from "../../lib/uploadFile.js";
import { useId, useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { Notice } from "../ui/Feedback.jsx";
import { imagePath } from "../../lib/media.js";

export function FileUpload({
  purpose,
  ticketId,
  value,
  onUploaded,
  label = "Upload image",
  documents = false,
  onBusyChange,
}) {
  const id = useId(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 3 * 1024 * 1024) {
      setError("Choose a file smaller than 3 MB.");
      event.target.value = "";
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      const url = await uploadFile(file, { purpose, ticketId });
      await onUploaded(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      event.target.value = "";
    }
  };
  return (
    <div className="file-upload">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={
          documents
            ? "image/jpeg,image/png,image/webp,application/pdf"
            : "image/jpeg,image/png,image/webp"
        }
        disabled={busy}
        onChange={upload}
      />
      <small>
        {busy
          ? "Uploading…"
          : documents
            ? "JPG, PNG, WebP or PDF · up to 3 MB"
            : "JPG, PNG or WebP · up to 3 MB"}
      </small>
      {value && (
        <a
          className="migration-button"
          href={imagePath(value)}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="eye" /> View uploaded file
        </a>
      )}
      <Notice error={error} />
    </div>
  );
}
