import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { imagePath } from "../../lib/media.js";
import { money } from "../../lib/format.js";
export function MealDetails({ meal, onClose, onAdd }) {
  const [quantity, setQuantity] = useState(1),
    [instructions, setInstructions] = useState("");
  return (
    <Modal title={meal.food_name} onClose={onClose}>
      <img
        className="migration-meal-image"
        src={imagePath(meal.image_path)}
        alt={meal.food_name}
      />
      <p>{meal.description}</p>
      <p>
        <Icon name="star" /> {Number(meal.ratings || 0).toFixed(1)} / 5
      </p>
      <form
        className="migration-form"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(meal, quantity, instructions);
        }}
      >
        <label>
          Quantity
          <input
            type="number"
            min="1"
            max="50"
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <label>
          Special request
          <textarea
            maxLength={500}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="For example: no chili"
          />
        </label>
        <h3>{money(Number(meal.price) * quantity)}</h3>
        <button className="migration-button primary">
          <Icon name="cart-plus" /> Add to Cart
        </button>
      </form>
    </Modal>
  );
}
