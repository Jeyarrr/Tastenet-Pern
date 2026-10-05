import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Badge, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { imagePath } from "../../lib/media.js";
import { Avatar } from "../../components/ui/Avatar.jsx";
import { PasswordInput } from "../../components/forms/PasswordInput.jsx";
import {
  AddressFields,
  PhoneInput,
  phoneDigits,
  useBarangays,
} from "./AccountFields.jsx";
import { FileUpload } from "../../components/forms/FileUpload.jsx";
import { uploadFile } from "../../lib/uploadFile.js";

const vehicleFields = {
  vehicle: ["Vehicle", "vehicle"],
  vehicleModel: ["Model", "vehicle_model"],
  vehicleYear: ["Year", "vehicle_year"],
  licensePlate: ["License Plate", "license_plate"],
  vehicleColor: ["Color", "vehicle_color"],
  licenseNumber: ["License Number", "license_number"],
  nbiNumber: ["NBI Number", "nbi_number"],
  orcrNumber: ["OR/CR Number", "orcr_number"],
  insurancePolicy: ["Insurance Policy", "insurance_policy"],
  insuranceDate: ["Insurance Expiry", "insurance_date"],
};
const documentsLabels = {
  driver_license_photo: "Driver's License",
  orcr_photo: "Vehicle OR/CR",
  insurance_photo: "Insurance",
  nbi_clearance_photo: "NBI Clearance",
};
function Info({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || "Not provided"}</dd>
    </div>
  );
}

export function AccountProfile({ profile, onSaved }) {
  const [editing, setEditing] = useState(false),
    [preview, setPreview] = useState(false),
    [documents, setDocuments] = useState([]),
    [error, setError] = useState("");
  const rider = profile.role === "rider";
  const loadDocuments = async () => {
    if (rider) setDocuments((await api("/api/auth/documents")).items);
  };
  useEffect(() => {
    loadDocuments().catch((e) => setError(e.message));
  }, [profile.id]);
  return (
    <div className="account-profile-panel">
      <Notice error={error} />
      <div className="account-profile-heading">
        <button
          className="account-photo-button"
          aria-label="View profile picture"
          onClick={() => setPreview(true)}
        >
          <Avatar large src={profile.profile_photo} name={profile.full_name} />
        </button>
        <div>
          <span className="account-eyebrow">
            {rider ? "YOUR RIDER ACCOUNT" : "YOUR CABALLEROS ACCOUNT"}
          </span>
          <h2>{profile.full_name}</h2>
          <p>@{profile.username}</p>
        </div>
        <button
          className="migration-button primary"
          onClick={() => setEditing(true)}
        >
          <Icon name="pen-to-square" />
          {rider ? "Edit Information" : "Edit Profile"}
        </button>
      </div>
      <section className="account-info-section">
        <h3>Personal information</h3>
        <dl className="account-info-grid">
          <Info label="Full name">{profile.full_name}</Info>
          <Info label="Username">{profile.username}</Info>
          <Info label="Email">{profile.email}</Info>
          <Info label="Mobile number">{profile.phone}</Info>
        </dl>
      </section>
      <section className="account-info-section">
        <h3>
          <Icon name="location-dot" /> Address
        </h3>
        {profile.address_details ? (
          <dl className="account-info-grid">
            <Info label="House / Building No.">
              {profile.address_details.houseNumber}
            </Info>
            <Info label="Street">{profile.address_details.street}</Info>
            <Info label="Barangay">{profile.address_details.barangay}</Info>
            <Info label="City">Dasmariñas, Cavite</Info>
          </dl>
        ) : (
          <p className="account-legacy-address">
            {profile.address || "No address saved yet."}
          </p>
        )}
      </section>
      {rider && (
        <>
          <section className="account-info-section">
            <h3>
              <Icon name="motorcycle" /> Vehicle information
            </h3>
            <dl className="account-info-grid">
              {Object.entries(vehicleFields).map(([key, [label, column]]) => (
                <Info key={key} label={label}>
                  {key === "insuranceDate"
                    ? profile[column]?.slice(0, 10)
                    : profile[column]}
                </Info>
              ))}
            </dl>
          </section>
          <section className="account-info-section">
            <h3>Documents &amp; verification</h3>
            <div className="document-grid">
              {documents.map((doc) => (
                <div className="document-card" key={doc.column}>
                  <h4>{documentsLabels[doc.column]}</h4>
                  <Badge value={doc.status} />
                  {doc.review_notes && <p>{doc.review_notes}</p>}
                  {doc.url && (
                    <a
                      className="migration-button"
                      href={imagePath(doc.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View document
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      {preview && (
        <Modal title="Profile Picture" onClose={() => setPreview(false)}>
          <div className="account-photo-preview">
            <Avatar
              large
              src={profile.profile_photo}
              name={profile.full_name}
            />
          </div>
        </Modal>
      )}
      {editing && (
        <ProfileEditor
          profile={profile}
          documents={documents}
          onClose={() => setEditing(false)}
          onSaved={async (next) => {
            await onSaved(next);
            await loadDocuments();
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
function ProfileEditor({ profile, documents, onClose, onSaved }) {
  const { refreshUser } = useAuth();
  const { areas, error: areaError } = useBarangays();
  const fileInput = useRef(null);
  const [form, setForm] = useState({
    fullName: profile.full_name,
    email: profile.email,
    phone: phoneDigits(profile.phone || ""),
    currentPassword: "",
    addressDetails: profile.address_details || {
      houseNumber: "",
      street: "",
      barangay: "",
    },
  });
  const [addressEnabled, setAddressEnabled] = useState(
      Boolean(profile.address_details),
    ),
    [photoUrl, setPhotoUrl] = useState(""),
    [vehicleDetails, setVehicleDetails] = useState(
      Object.fromEntries(
        Object.entries(vehicleFields).map(([key, [, column]]) => [
          key,
          profile[column]?.slice?.(
            0,
            key === "insuranceDate" ? 10 : undefined,
          ) || "",
        ]),
      ),
    ),
    [changedDocuments, setChangedDocuments] = useState({});
  const [activeUploads, setActiveUploads] = useState(0);
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const change = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <Modal
      title={
        profile.role === "rider" ? "Edit Rider Information" : "Edit Profile"
      }
      onClose={onClose}
      wide
    >
      <form
        className="migration-form account-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setBusy(true);
          try {
            const result = await api("/api/auth/profile", {
              method: "PATCH",
              body: {
                fullName: form.fullName,
                email: form.email,
                phone: `+63${form.phone}`,
                currentPassword: form.currentPassword,
                ...(addressEnabled
                  ? { addressDetails: form.addressDetails }
                  : {}),
                ...(photoUrl ? { photoUrl } : {}),
                ...(profile.role === "rider"
                  ? { vehicleDetails, documents: changedDocuments }
                  : {}),
              },
            });
            await refreshUser();
            await onSaved(result.profile);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="account-photo-editor">
          <button
            type="button"
            className="account-photo-button"
            disabled={uploading || busy}
            aria-label="Change profile picture"
            onClick={() => fileInput.current?.click()}
          >
            <Avatar
              large
              src={photoUrl || profile.profile_photo}
              name={form.fullName}
            />
            <span className="account-photo-edit-icon">
              <Icon name="camera" />
            </span>
          </button>
          <div>
            <strong>Profile picture</strong>
            <p>
              {uploading
                ? "Uploading…"
                : "Click the photo to change it. JPG, PNG or WebP · up to 3 MB."}
            </p>
          </div>
        </div>
        <input
          ref={fileInput}
          className="proof-file-input"
          type="file"
          aria-label="Upload profile picture"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (event) => {
            const input = event.currentTarget,
              file = input.files?.[0];
            if (!file) return;
            setUploading(true);
            setError("");
            try {
              setPhotoUrl(await uploadFile(file, { purpose: "profile" }));
            } catch (e) {
              setError(e.message);
            } finally {
              setUploading(false);
              input.value = "";
            }
          }}
        />
        <h3>Personal information</h3>
        <div className="account-fields-grid">
          <label>
            Full name
            <input
              aria-label="Full name"
              value={form.fullName}
              required
              maxLength={200}
              onChange={(e) => change("fullName", e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              aria-label="Email"
              type="email"
              autoComplete="email"
              value={form.email}
              required
              onChange={(e) => change("email", e.target.value)}
            />
          </label>
          <label>
            Mobile number
            <PhoneInput
              value={form.phone}
              onChange={(value) => change("phone", value)}
            />
          </label>
          <label>
            Username
            <input value={profile.username} readOnly />
          </label>
        </div>
        <h3>Address information</h3>
        {!profile.address_details && (
          <>
            <p className="account-legacy-address">
              Current address: {profile.address || "Not provided"}
            </p>
            <label className="account-checkbox">
              <input
                type="checkbox"
                checked={addressEnabled}
                onChange={(e) => setAddressEnabled(e.target.checked)}
              />
              Update delivery address
            </label>
          </>
        )}
        {addressEnabled && (
          <AddressFields
            value={form.addressDetails}
            onChange={(value) => change("addressDetails", value)}
            areas={areas}
          />
        )}
        {profile.role === "rider" && (
          <>
            <h3>Vehicle information</h3>
            <div className="account-fields-grid">
              {Object.entries(vehicleFields).map(([key, [label]]) => (
                <label key={key}>
                  {label}
                  <input
                    type={key === "insuranceDate" ? "date" : "text"}
                    value={vehicleDetails[key]}
                    maxLength={
                      key === "vehicleYear"
                        ? 20
                        : key === "licensePlate" || key === "vehicleColor"
                          ? 40
                          : 100
                    }
                    onChange={(e) =>
                      setVehicleDetails({
                        ...vehicleDetails,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <h3>Documents</h3>
            <div className="document-grid">
              {documents.map((doc) => (
                <div className="document-card" key={doc.column}>
                  <FileUpload
                    purpose="rider-document"
                    onBusyChange={(active) =>
                      setActiveUploads((count) =>
                        Math.max(0, count + (active ? 1 : -1)),
                      )
                    }
                    documents
                    label={documentsLabels[doc.column]}
                    value={changedDocuments[doc.column] || doc.url}
                    onUploaded={(url) =>
                      setChangedDocuments((previous) => ({
                        ...previous,
                        [doc.column]: url,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="account-confirmation">
          <label>
            Confirm with your password
            <PasswordInput
              aria-label="Current password"
              visibilityLabel="current password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(e) => change("currentPassword", e.target.value)}
            />
          </label>
          <small>Your password is required to save these changes.</small>
        </div>
        <Notice error={error || (addressEnabled ? areaError : "")} />
        <div className="migration-form-actions">
          <button
            type="button"
            className="migration-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="migration-button primary"
            disabled={busy || uploading || activeUploads > 0}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
