import { useEffect, useState } from "react";
import { imagePath } from "../../lib/media.js";

export function Avatar({ src, name = "Account", large = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span className={`account-avatar ${large ? "large" : ""}`}>
      {src && !failed ? (
        <img
          src={imagePath(src)}
          alt={`${name}'s profile`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span role="img" aria-label={`${name}, no profile photo`}>
          {initials}
        </span>
      )}
    </span>
  );
}
