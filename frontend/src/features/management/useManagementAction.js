import { useState } from "react";

export function useAction(onSaved) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const run = async (work) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      await onSaved?.();
      setSuccess("Changes saved.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, success, run };
}
