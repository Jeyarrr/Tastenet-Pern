import { Icon } from "../../components/ui/Icon.jsx";
import { Modal } from "../../components/ui/Modal.jsx";

export function DeliveryNavigation({ order, onClose }) {
  const address = order.delivery_address || "";
  const destination = /dasmari[ñn]as/i.test(address)
    ? address
    : `${address}, Dasmariñas, Cavite`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  return (
    <Modal title="Delivery Navigation" onClose={onClose} wide>
      <div className="navigation-summary">
        <span className="navigation-icon">
          <Icon name="route" />
        </span>
        <div>
          <h3>{order.ticket_number}</h3>
          <p>{order.customer_name || "Customer delivery"}</p>
        </div>
      </div>
      <dl className="navigation-stops">
        <div>
          <dt>Pickup</dt>
          <dd>Caballeros — Blk 84, Lot 10 Bautista St, Zone 9, Dasmariñas</dd>
        </div>
        <div>
          <dt>Drop-off</dt>
          <dd>{address || "No delivery address provided"}</dd>
        </div>
      </dl>
      {address && (
        <iframe
          className="delivery-map"
          title="Delivery destination map"
          src={`https://www.google.com/maps?q=${encodeURIComponent(destination)}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      )}
      <p className="muted">
        Check the address before starting. Google Maps opens turn-by-turn
        directions in a new tab or your Maps app.
      </p>
      <div className="migration-form-actions">
        <button className="migration-button" onClick={onClose}>
          Back
        </button>
        {address && (
          <a
            className="migration-button primary"
            href={directions}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="directions" /> Start Navigation
          </a>
        )}
      </div>
    </Modal>
  );
}
