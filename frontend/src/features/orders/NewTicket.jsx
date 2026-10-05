import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/format.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";

export function NewTicket({ menu, close, action, error, busy }) {
  const [fees, setFees] = useState([]),
    [methods, setMethods] = useState([]),
    [form, setForm] = useState({
      orderType: "Dine-In",
      deliveryAddress: "",
      barangayName: "",
      paymentMethod: "",
      items: {},
    });
  useEffect(() => {
    let live = true;
    Promise.all([api("/api/delivery-fees"), api("/api/payment-methods")])
      .then(([f, m]) => {
        if (!live) return;
        setFees(f.items);
        setMethods(m.items);
        setForm((old) => ({
          ...old,
          barangayName: f.items[0]?.barangay_name || "",
          paymentMethod: m.items[0]?.method_name || "",
        }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <Modal title="Create New Ticket" onClose={close}>
      <form
        className="migration-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const items = Object.entries(form.items)
            .filter(([, quantity]) => Number(quantity) > 0)
            .map(([menuId, quantity]) => ({
              menuId: Number(menuId),
              quantity: Number(quantity),
            }));
          if (
            await action(
              () =>
                api("/api/orders", {
                  method: "POST",
                  body: {
                    items,
                    orderType: form.orderType,
                    priority: form.priority,
                    instructions: form.instructions,
                    requestKey: form.requestKey,
                    deliveryAddress: form.deliveryAddress,
                    barangayName: form.barangayName,
                    paymentMethod: form.paymentMethod,
                  },
                }),
              "Ticket created.",
            )
          )
            close();
        }}
      >
        <Notice error={error} />
        <label>
          Order Type
          <select
            value={form.orderType}
            onChange={(e) => setForm({ ...form, orderType: e.target.value })}
          >
            <option>Dine-In</option>
            <option>Take-Out</option>
            <option>Delivery</option>
          </select>
        </label>
        <label>
          Priority
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option>Normal</option>
            <option>Rush</option>
          </select>
        </label>
        <label>
          Order instructions
          <textarea
            maxLength={1000}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </label>
        {form.orderType === "Delivery" && (
          <>
            <label>
              Delivery Address
              <input
                value={form.deliveryAddress}
                onChange={(e) =>
                  setForm({ ...form, deliveryAddress: e.target.value })
                }
                required
                minLength={5}
              />
            </label>
            <label>
              Barangay
              <select
                value={form.barangayName}
                onChange={(e) =>
                  setForm({ ...form, barangayName: e.target.value })
                }
              >
                {fees.map((item) => (
                  <option key={item.id}>{item.barangay_name}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Payment Method
          <select
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            required
          >
            {methods.map((item) => (
              <option key={item.id}>{item.method_name}</option>
            ))}
          </select>
        </label>
        {menu.map((item) => (
          <label key={item.id}>
            {item.food_name} — {money(item.price)}
            <input
              type="number"
              min="0"
              max="50"
              value={form.items[item.id] || ""}
              placeholder="Quantity"
              onChange={(e) =>
                setForm({
                  ...form,
                  items: { ...form.items, [item.id]: e.target.value },
                })
              }
            />
          </label>
        ))}
        <button
          className="migration-button primary"
          disabled={busy || !methods.length}
        >
          Create Ticket
        </button>
      </form>
    </Modal>
  );
}
