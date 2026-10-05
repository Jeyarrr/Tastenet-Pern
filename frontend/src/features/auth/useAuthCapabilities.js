import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

export function useAuthCapabilities() {
  const [capabilities, setCapabilities] = useState({
    google: false,
    email: false,
    registrationOtp: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    api("/api/auth/capabilities", { signal: controller.signal })
      .then(setCapabilities)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return capabilities;
}
