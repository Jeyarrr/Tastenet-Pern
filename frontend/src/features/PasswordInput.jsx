import { useEffect, useId, useState } from "react";
import { Icon } from "../components.jsx";
import "./password-input.css";

export function PasswordInput({ id, visibilityLabel = "password", ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!props.value) setVisible(false);
  }, [props.value]);

  return (
    <span className="tastenet-password-field">
      <input {...props} id={inputId} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="tastenet-password-eye"
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-controls={inputId}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible((previous) => !previous)}
      >
        <Icon name={visible ? "eye-slash" : "eye"} />
      </button>
    </span>
  );
}
