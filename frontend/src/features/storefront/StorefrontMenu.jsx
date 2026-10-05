import { money } from "../../lib/format.js";
import { Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { imagePath } from "../../lib/media.js";

export function StorefrontMenu({
  setSearch,
  query,
  setQuery,
  selectedCategory,
  setSelectedCategory,
  dialog,
  error,
  setSuccess,
  loading,
  open,
  updateCart,
  categories,
  filtered,
}) {
  return (
    <section id="menu" className="menu-display-section section-fade-in visible">
      <div className="storefront-menu-heading">
        <div>
          <span className="storefront-eyebrow">WHAT ARE YOU CRAVING?</span>
          <h2 className="menu-header">DISCOVER OUR MENU</h2>
          <p>A little comfort. A lot of flavor. Choose your next favorite.</p>
        </div>
        <span className="menu-delivery-note">
          <Icon name="motorcycle" /> Free delivery on orders ₱500 and up
        </span>
      </div>
      <nav className="menu-category-tabs" aria-label="Menu categories">
        {["All", ...categories].map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? "active" : ""}
            aria-pressed={selectedCategory === category}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>
      {query && (
        <div className="menu-search-summary">
          Results for “{query}”
          <button
            onClick={() => {
              setQuery("");
              setSearch("");
            }}
          >
            Clear search <Icon name="xmark" />
          </button>
        </div>
      )}
      <Notice error={dialog ? "" : error} />
      {loading ? (
        <p className="migration-loading">Loading menu…</p>
      ) : !filtered.some(
          (item) =>
            selectedCategory === "All" || item.food_type === selectedCategory,
        ) ? (
        <Empty title="No menu items found" />
      ) : (
        categories
          .filter(
            (category) =>
              selectedCategory === "All" || selectedCategory === category,
          )
          .map((category) => {
            const items = filtered.filter(
              (item) => item.food_type === category,
            );
            if (!items.length) return null;
            return (
              <div className="menu-category-container" key={category}>
                <h3 className="category-title">{category}</h3>
                <div className="menu-grid-container">
                  {items.map((item) => (
                    <article className="menu-container" key={item.id}>
                      <img
                        className="menu-featured-img"
                        src={imagePath(item.image_path)}
                        alt={item.food_name}
                        loading="lazy"
                      />
                      <div className="menu-list-container">
                        <span className="meal-category-tag">
                          {item.food_type}
                        </span>
                        <h4 className="category-label">{item.food_name}</h4>
                        {item.description && (
                          <div className="meal-description-short">
                            {item.description}
                          </div>
                        )}
                        <div className="item-price-small">
                          {money(item.price)}
                        </div>
                        <div className="menu-item-buttons">
                          <button
                            className="view-btn"
                            onClick={() => open(item)}
                          >
                            <Icon name="eye" /> View
                          </button>
                          <button
                            className="add-to-cart-btn-text"
                            onClick={() => {
                              if (!updateCart(item, 1)) return;
                              setSuccess(
                                `${item.food_name} added to your order.`,
                              );
                            }}
                          >
                            <Icon name="plus" /> Add
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })
      )}
    </section>
  );
}
