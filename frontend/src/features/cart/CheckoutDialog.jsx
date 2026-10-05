import { money } from "../../lib/format.js";
import { Icon } from "../../components/ui/Icon.jsx";
import { imagePath } from "../../lib/media.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";

export function CheckoutDialog({
  fees,
  methods,
  checkout,
  setCheckout,
  error,
  busy,
  close,
  lines,
  subtotal,
  delivery,
  placeOrder,
}) {
  return (
    <Modal title="Checkout" onClose={close}>
      <form className="migration-form" onSubmit={placeOrder}>
        <Notice error={error} />
        <div className="checkout-section">
          <h4>
            <Icon name="location-dot" /> Delivery Address
          </h4>
          <label>
            House, street and address
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={checkout.deliveryAddress}
              onChange={(e) =>
                setCheckout({
                  ...checkout,
                  deliveryAddress: e.target.value,
                })
              }
            />
          </label>
          <label>
            Barangay
            <select
              value={checkout.barangayName}
              onChange={(e) =>
                setCheckout({ ...checkout, barangayName: e.target.value })
              }
              required
            >
              {fees.map((fee) => (
                <option key={fee.id}>{fee.barangay_name}</option>
              ))}
            </select>
          </label>
          <p className="muted">Service area: Dasmariñas City only</p>
        </div>
        <div className="checkout-section">
          <h4>
            <Icon name="credit-card" /> Payment Method
          </h4>
          <div className="payment-options">
            {methods.map((method) => (
              <label className="payment-option" key={method.id}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.method_name}
                  checked={checkout.paymentMethod === method.method_name}
                  onChange={(e) =>
                    setCheckout({
                      ...checkout,
                      paymentMethod: e.target.value,
                    })
                  }
                  required
                />
                <div className="payment-option-content">
                  <Icon name="wallet" />
                  <span>{method.method_name}</span>
                  {method.qr_photo && (
                    <img
                      className="payment-qr"
                      src={imagePath(method.qr_photo)}
                      alt={`${method.method_name} payment QR`}
                    />
                  )}
                  {method.account_details && (
                    <small>{method.account_details}</small>
                  )}
                  {method.instructions && <small>{method.instructions}</small>}
                </div>
              </label>
            ))}
          </div>
        </div>
        <label>
          Special Instructions (Optional)
          <textarea
            value={checkout.instructions}
            maxLength={500}
            onChange={(e) =>
              setCheckout({ ...checkout, instructions: e.target.value })
            }
            placeholder="No chili, extra napkins, ring the bell..."
          />
        </label>
        <div className="cart-summary-row cart-total">
          <span>Total</span>
          <strong>{money(subtotal + delivery)}</strong>
        </div>
        <button
          className="migration-button primary"
          disabled={busy || !lines.length || !methods.length || !fees.length}
        >
          {busy ? "Placing order…" : "Confirm Order"}
        </button>
      </form>
    </Modal>
  );
}
