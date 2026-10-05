import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/Icon.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { imagePath } from "../../lib/media.js";
import { uploadFile } from "../../lib/uploadFile.js";
export function DeliveryConfirmation({
  order,
  onClose,
  onComplete,
  busy,
  error,
}) {
  const [proofUrl, setProofUrl] = useState(""),
    [cameraOpen, setCameraOpen] = useState(false),
    [uploading, setUploading] = useState(false),
    [captureError, setCaptureError] = useState("");
  const fileInput = useRef(null);
  const upload = async (file) => {
    setCaptureError("");
    setUploading(true);
    try {
      const url = await uploadFile(file, {
        purpose: "delivery-proof",
        ticketId: order.id,
      });
      setProofUrl(url);
      return true;
    } catch (e) {
      setCaptureError(e.message);
      return false;
    } finally {
      setUploading(false);
    }
  };
  return (
    <Modal title="Confirm Delivery" onClose={onClose}>
      <Notice error={captureError || error} />
      <p>Add a photo as proof of delivery for {order.ticket_number}.</p>
      <div className="proof-source-options">
        <button
          className="proof-source-button"
          disabled={busy || uploading}
          onClick={() => {
            setCaptureError("");
            setCameraOpen(true);
          }}
        >
          <Icon name="camera" />
          <strong>Use Camera</strong>
          <span>Take a photo now</span>
        </button>
        <button
          className="proof-source-button"
          disabled={busy || uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="image" />
          <strong>Upload Image</strong>
          <span>Choose from your device</span>
        </button>
      </div>
      <input
        ref={fileInput}
        className="proof-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Upload delivery image"
        onChange={async (e) => {
          const input = e.currentTarget,
            file = input.files?.[0];
          if (file) await upload(file);
          input.value = "";
        }}
      />
      <p className="proof-file-hint">
        {uploading
          ? "Uploading your delivery photo…"
          : "JPG, PNG or WebP · up to 3 MB"}
      </p>
      {proofUrl && (
        <div className="delivery-proof-preview">
          <img src={imagePath(proofUrl)} alt="Delivery proof ready to submit" />
          <span>
            <Icon name="circle-check" /> Photo ready. Confirm below to complete
            the delivery.
          </span>
        </div>
      )}
      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={async (file) => {
            if (await upload(file)) setCameraOpen(false);
          }}
          busy={uploading}
          error={captureError}
        />
      )}
      <div className="migration-form-actions">
        <button type="button" className="migration-button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="migration-button primary"
          disabled={busy || uploading || !proofUrl}
          onClick={async () => {
            if (await onComplete(order, proofUrl)) onClose();
          }}
        >
          Mark as Delivered
        </button>
      </div>
    </Modal>
  );
}

function CameraCapture({ onClose, onCapture, busy, error }) {
  const video = useRef(null),
    stream = useRef(null);
  const [ready, setReady] = useState(false),
    [cameraError, setCameraError] = useState("");
  useEffect(() => {
    let active = true;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera access is unavailable. Open TasteNet over HTTPS or localhost, or choose Upload Image.",
        );
        return;
      }
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (!active) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        video.current.srcObject = media;
        await video.current.play();
      } catch (e) {
        if (active)
          setCameraError(
            e.name === "NotAllowedError"
              ? "Camera permission was denied. Allow camera access in your browser or use Upload Image."
              : "No available camera was found. Choose Upload Image to use an existing photo.",
          );
      }
    };
    start();
    return () => {
      active = false;
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const capture = () => {
    if (!video.current?.videoWidth) return;
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 1600 / video.current.videoWidth);
    canvas.width = Math.round(video.current.videoWidth * scale);
    canvas.height = Math.round(video.current.videoHeight * scale);
    canvas
      .getContext("2d")
      .drawImage(video.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob)
          onCapture(
            new File([blob], "delivery-photo.jpg", { type: "image/jpeg" }),
          );
        else setCameraError("Could not capture the photo. Try again.");
      },
      "image/jpeg",
      0.85,
    );
  };
  return (
    <Modal title="Take a Delivery Photo" onClose={onClose}>
      <Notice error={cameraError || error} />
      <video
        className="delivery-camera"
        ref={video}
        autoPlay
        playsInline
        muted
        onLoadedData={() => setReady(true)}
      />
      <p className="muted">Frame the delivered order, then take the photo.</p>
      <div className="migration-form-actions">
        <button className="migration-button" onClick={onClose}>
          Back to Photo Options
        </button>
        <button
          className="migration-button primary"
          disabled={!ready || busy || Boolean(cameraError)}
          onClick={capture}
        >
          <Icon name="camera" />
          {busy ? "Uploading…" : "Take Photo"}
        </button>
      </div>
    </Modal>
  );
}
