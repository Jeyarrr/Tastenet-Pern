import { money } from "../../lib/format.js";
import { Icon } from "../../components/ui/Icon.jsx";
import { Modal } from "../../components/ui/Modal.jsx";

export function CartDialog({
  setCart,
  close,
  updateCart,
  lines,
  count,
  subtotal,
  delivery,
  checkoutOpen,
}) {
  return (
    <Modal
      title="Your order"
      variant="cart-drawer"
      onClose={close}
      bodyClass="original-customer cart-surface"
    >
      <div className="cart-modal-body">
        {!lines.length ? (
          <div className="cart-empty-state">
            <Icon name="basket-shopping" />
            <p>Your cart is empty</p>
            <a href="#menu" className="btn-browse-menu" onClick={close}>
              Browse Menu
            </a>
          </div>
        ) : (
          lines.map((item) => (
            <div className="cart-item" key={item.id}>
              <div className="cart-item-header">
                <div className="cart-item-name">{item.food_name}</div>
                <div className="cart-item-price">
                  {money(Number(item.price) * item.quantity)}
                </div>
              </div>
              <label className="cart-instructions">
                Special request
                <input
                  maxLength={500}
                  value={item.specialInstructions || ""}
                  onChange={(e) =>
                    setCart((old) => ({
                      ...old,
                      [item.id]: {
                        ...old[item.id],
                        specialInstructions: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <div className="cart-item-controls">
                <div className="quantity-controls">
                  <button
                    className="quantity-btn"
                    aria-label={`Remove one ${item.food_name}`}
                    onClick={() => updateCart(item, -1)}
                  >
                    −
                  </button>
                  <span className="quantity-value">{item.quantity}</span>
                  <button
                    className="quantity-btn"
                    aria-label={`Add one ${item.food_name}`}
                    onClick={() => updateCart(item, 1)}
                  >
                    +
                  </button>
                </div>
                <button
                  className="remove-item-btn"
                  onClick={() => updateCart(item, -item.quantity)}
                >
                  <Icon name="trash" /> Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="cart-modal-footer">
        <div className="cart-summary">
          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="cart-summary-row">
            <span>Delivery Fee</span>
            <span>{money(delivery)}</span>
          </div>
          <div className="cart-summary-row cart-total">
            <span>Total</span>
            <span>{money(subtotal + delivery)}</span>
          </div>
        </div>
        <div className="cart-actions">
          <button
            className="btn-clear-cart"
            disabled={!count}
            onClick={() => setCart({})}
          >
            Clear Cart
          </button>
          <button
            className="btn-checkout"
            disabled={!count}
            onClick={checkoutOpen}
          >
            Checkout
          </button>
        </div>
        <div className="cart-delivery-info">
          <Icon name="circle-info" />
          <span>
            Delivery fee is based on your barangay. Free delivery on orders over
            ₱500.
          </span>
        </div>
      </div>
    </Modal>
  );
}
