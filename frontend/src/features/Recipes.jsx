import { useEffect, useState } from "react";
import { money } from "../api.js";
import { Empty, Icon, Notice } from "../components.jsx";
export function Recipes({
  recipes,
  menu,
  inventory,
  save,
  error,
  success,
  busy,
}) {
  const [selected, setSelected] = useState(null),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState([]),
    [ingredient, setIngredient] = useState(""),
    [quantity, setQuantity] = useState(1);
  const choose = (item) => {
    setSelected(item);
    setDraft(
      recipes
        .filter((recipe) => String(recipe.menu_id) === String(item.id))
        .map((recipe) => ({
          inventoryId: Number(recipe.inventory_id),
          quantity: Number(recipe.quantity_required),
        })),
    );
  };
  const stock = (id) =>
    inventory.find((item) => Number(item.id) === Number(id));
  return (
    <div id="rmWrapper">
      <div className="rm-header">
        <div>
          <h2>
            <Icon name="book-open" /> Recipe Manager
          </h2>
          <p>Set up ingredients and quantity needed for each serving</p>
        </div>
      </div>
      <Notice error={error} success={success} />
      <div className="rm-layout">
        <div className="rm-panel">
          <div className="rm-panel-head">
            <h3>
              <Icon name="utensils" /> Menu Items
            </h3>
            <span>{menu.length} items</span>
          </div>
          <div className="rm-panel-body">
            <div className="rm-search">
              <Icon name="magnifying-glass" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu..."
                aria-label="Search recipes"
              />
            </div>
            {menu
              .filter((item) =>
                item.food_name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((item) => (
                <button
                  className={`rm-menu-item ${selected?.id === item.id ? "active" : ""}`}
                  key={item.id}
                  onClick={() => choose(item)}
                >
                  <div className="rm-menu-left">
                    <div className="rm-avatar">
                      {item.food_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="rm-menu-name">{item.food_name}</div>
                      <div className="rm-menu-id">MenuID: {item.id}</div>
                    </div>
                  </div>
                  <span className="rm-count">
                    {
                      recipes.filter(
                        (recipe) => String(recipe.menu_id) === String(item.id),
                      ).length
                    }{" "}
                    ingredients
                  </span>
                </button>
              ))}
          </div>
        </div>
        <div className="rm-panel">
          {!selected ? (
            <div className="rm-empty">
              <Icon name="hand-pointer" />
              <h3>Select a menu item</h3>
              <p>
                Click any dish on the left to set up or edit its ingredients
              </p>
            </div>
          ) : (
            <>
              <div className="rm-editor-head">
                <h3>{selected.food_name}</h3>
                <p>
                  Add every ingredient this dish uses — quantity needed per 1
                  serving
                </p>
              </div>
              <div className="rm-editor-body">
                <form
                  className="rm-add-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      ingredient &&
                      !draft.some(
                        (item) => item.inventoryId === Number(ingredient),
                      )
                    )
                      setDraft([
                        ...draft,
                        {
                          inventoryId: Number(ingredient),
                          quantity: Number(quantity),
                        },
                      ]);
                  }}
                >
                  <div>
                    <label htmlFor="recipe-ingredient">Ingredient</label>
                    <select
                      id="recipe-ingredient"
                      className="rm-control"
                      required
                      value={ingredient}
                      onChange={(e) => setIngredient(e.target.value)}
                    >
                      <option value="">Select ingredient</option>
                      {inventory
                        .filter(
                          (item) =>
                            !draft.some(
                              (row) => row.inventoryId === Number(item.id),
                            ),
                        )
                        .map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.item_name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="recipe-quantity">Qty / serving</label>
                    <input
                      id="recipe-quantity"
                      className="rm-control"
                      type="number"
                      min=".001"
                      step=".001"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Unit</label>
                    <input
                      aria-label="Ingredient unit"
                      className="rm-control"
                      readOnly
                      value={stock(ingredient)?.unit_of_measure || ""}
                    />
                  </div>
                  <button className="rm-btn-add" disabled={busy}>
                    ＋ Add
                  </button>
                </form>
                <table className="rm-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Qty per serving</th>
                      <th>Unit</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.map((item) => (
                      <tr key={item.inventoryId}>
                        <td>
                          {stock(item.inventoryId)?.item_name ||
                            `Ingredient ${item.inventoryId}`}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{stock(item.inventoryId)?.unit_of_measure}</td>
                        <td>
                          <button
                            className="rm-del-btn"
                            aria-label={`Remove ${stock(item.inventoryId)?.item_name}`}
                            onClick={() =>
                              setDraft(
                                draft.filter(
                                  (row) => row.inventoryId !== item.inventoryId,
                                ),
                              )
                            }
                          >
                            <Icon name="trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="migration-form-actions">
                  <button
                    className="migration-button primary"
                    disabled={busy}
                    onClick={() => save(selected.id, draft)}
                  >
                    Save Recipe
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
