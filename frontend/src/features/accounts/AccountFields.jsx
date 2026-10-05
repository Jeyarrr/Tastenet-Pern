import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

export function phoneDigits(value = "") {
  return value
    .replace(/\D/g, "")
    .replace(/^(?:63|0)(?=9)/, "")
    .slice(0, 10);
}
export function PhoneInput({ value, onChange, ...props }) {
  return (
    <span className="account-phone-input">
      <span className="phone-country" aria-label="Philippines, plus 63">
        <svg viewBox="0 0 36 24" aria-hidden="true">
          <path fill="#0038a8" d="M0 0h36v12H0z" />
          <path fill="#ce1126" d="M0 12h36v12H0z" />
          <path fill="#fff" d="m0 0 21 12L0 24z" />
          <circle cx="7" cy="12" r="3" fill="#fcd116" />
          <path
            fill="#fcd116"
            d="m3 3 1 2-2 1 1-3zm0 15 1 2-2 1 1-3zm13-7 1 2-2 1 1-3z"
          />
        </svg>
        +63
      </span>
      <input
        {...props}
        type="tel"
        aria-label={props["aria-label"] || "Mobile number"}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="9XXXXXXXXX"
        pattern="9[0-9]{9}"
        value={value}
        onChange={(event) => onChange(phoneDigits(event.target.value))}
        required
      />
    </span>
  );
}
export function useBarangays() {
  const [areas, setAreas] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("/api/delivery-fees", { signal: controller.signal })
      .then((data) =>
        setAreas([...new Set(data.items.map((item) => item.barangay_name))]),
      )
      .catch((error) => {
        if (error.name !== "AbortError")
          setError("Could not load barangays. Please reload and try again.");
      });
    return () => controller.abort();
  }, []);
  return { areas, error };
}
export function AddressFields({ value, onChange, areas }) {
  return (
    <div className="account-fields-grid">
      <label>
        House / Building No.
        <input
          aria-label="House / Building No."
          autoComplete="address-line1"
          maxLength={120}
          required
          value={value.houseNumber}
          onChange={(e) => onChange({ ...value, houseNumber: e.target.value })}
        />
      </label>
      <label>
        Street
        <input
          aria-label="Street"
          autoComplete="address-line2"
          maxLength={200}
          required
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
        />
      </label>
      <label>
        Barangay
        <select
          aria-label="Barangay"
          required
          value={value.barangay}
          onChange={(e) => onChange({ ...value, barangay: e.target.value })}
        >
          <option value="">
            {areas.length ? "Select your barangay" : "Loading barangays…"}
          </option>
          {areas.map((area) => (
            <option key={area}>{area}</option>
          ))}
        </select>
      </label>
      <label>
        City
        <input aria-label="City" value="Dasmariñas, Cavite" readOnly />
      </label>
    </div>
  );
}
