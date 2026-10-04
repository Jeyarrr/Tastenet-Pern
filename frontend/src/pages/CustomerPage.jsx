import { AccountProfile } from "../features/AccountProfile.jsx";
import { FindUs } from "../features/FindUs.jsx";
import { passwordPattern, passwordHelp } from "../features/AccountFields.jsx";
import { PasswordInput } from "../features/PasswordInput.jsx";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, dateTime, money } from "../api.js";
import { useAuth } from "../auth.jsx";
import {
  Badge,
  Empty,
  Icon,
  imagePath,
  Modal,
  Notice,
} from "../components.jsx";
import { useCart } from "../features/useCart.js";
import { OrderDetails } from "../features/OrderDetails.jsx";
import { MealDetails } from "../features/MealDetails.jsx";
import { FileUpload } from "../features/FileUpload.jsx";
import sections from "../original/website-sections.json";
import "../original/customer.css";
import "../features/customer-storefront.css";
import { useStorefrontMotion } from "../features/useStorefrontMotion.js";

function StaticSection({ name, onClick }) {
  return (
    <div
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: sections[name] }}
    />
  );
}

export function CustomerPage() {
  const storefrontRef = useStorefrontMotion();
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]),
    [fees, setFees] = useState([]),
    [methods, setMethods] = useState([]),
    [orders, setOrders] = useState([]);
  const orderRequestKey = useRef(crypto.randomUUID());
  const [cart, setCart] = useCart(user?.id);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [selectedCategory, setSelectedCategory] = useState("All");
  const [dialog, setDialog] = useState(null),
    [profileOpen, setProfileOpen] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false);
  const [checkout, setCheckout] = useState({
    deliveryAddress: "",
    barangayName: "",
    paymentMethod: "",
    instructions: "",
  });
  const [profile, setProfile] = useState(null),
    [passwords, setPasswords] = useState({
      currentPassword: "",
      newPassword: "",
    });
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([
      api("/api/menu"),
      api("/api/delivery-fees"),
      api("/api/payment-methods"),
      user ? api("/api/orders") : { items: [] },
      user ? api("/api/auth/profile") : null,
    ])
      .then(([m, f, p, o, account]) => {
        if (!live) return;
        setMenu(m.items);
        setCart((old) =>
          Object.fromEntries(
            Object.entries(old)
              .filter(([id]) =>
                m.items.some(
                  (item) =>
                    String(item.id) === id && item.status !== "inactive",
                ),
              )
              .map(([id, line]) => [
                id,
                {
                  ...m.items.find((item) => String(item.id) === id),
                  quantity: line.quantity,
                  specialInstructions: line.specialInstructions || "",
                },
              ]),
          ),
        );
        setFees(f.items);
        setMethods(p.items);
        setOrders(o.items);
        setProfile(account?.profile || null);
        setCheckout((old) => ({
          ...old,
          deliveryAddress: account?.profile?.address || "",
          barangayName:
            f.items.find((item) =>
              account?.profile?.address?.includes(item.barangay_name),
            )?.barangay_name ||
            f.items[0]?.barangay_name ||
            "",
          paymentMethod: p.items[0]?.method_name || "",
        }));
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [user?.id]);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 50);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const close = () => {
    setDialog(null);
    setError("");
  };
  const open = (name) => {
    setProfileOpen(false);
    setMobileOpen(false);
    setError("");
    setSuccess("");
    setDialog(name);
  };
  const updateCart = (product, delta, instructions) => {
    if (!user) {
      open("sign-in-required");
      return false;
    }
    setCart((old) => {
      const next = { ...old },
        quantity = Math.min(
          50,
          Math.max(0, (next[product.id]?.quantity || 0) + delta),
        );
      if (!quantity) delete next[product.id];
      else
        next[product.id] = {
          ...product,
          quantity,
          specialInstructions:
            instructions ?? old[product.id]?.specialInstructions ?? "",
        };
      return next;
    });
    return true;
  };
  const lines = Object.values(cart),
    count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = lines.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
  const delivery =
    subtotal >= 500
      ? 0
      : Number(
          fees.find((item) => item.barangay_name === checkout.barangayName)
            ?.fee || 0,
        );
  const categoryPriority = [
    "Silog",
    "Sizzling Specials",
    "Special Meals",
    "Beverage",
  ];
  const categories = [...new Set(menu.map((item) => item.food_type))].sort(
    (a, b) => {
      const rank = (value) =>
        categoryPriority.includes(value)
          ? categoryPriority.indexOf(value)
          : categoryPriority.length;
      return rank(a) - rank(b) || String(a).localeCompare(String(b));
    },
  );
  const filtered = menu.filter((item) =>
    `${item.food_name} ${item.description || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const act = async (work, message) => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await work();
      setSuccess(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const placeOrder = (event) => {
    event.preventDefault();
    act(async () => {
      const data = await api("/api/orders", {
        method: "POST",
        body: {
          deliveryAddress: checkout.deliveryAddress,
          barangayName: checkout.barangayName,
          paymentMethod: checkout.paymentMethod,
          instructions: checkout.instructions,
          requestKey: orderRequestKey.current,
          items: lines.map((item) => ({
            menuId: item.id,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions || "",
          })),
        },
      });
      setCart({});
      orderRequestKey.current = crypto.randomUUID();
      setOrders((await api("/api/orders")).items);
      setDialog("orders");
      return data;
    }, "Your order has been placed.");
  };
  const cancel = (id) =>
    act(async () => {
      await api(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: { status: "Cancelled" },
      });
      setOrders((await api("/api/orders")).items);
    }, "Order cancelled.");
  const changePassword = (event) => {
    event.preventDefault();
    act(async () => {
      await api("/api/auth/password", { method: "PATCH", body: passwords });
      setPasswords({ currentPassword: "", newPassword: "" });
    }, "Password changed.");
  };
  const navLinks = [
    ["home", "Home"],
    ["menu", "Menu"],
    ["about", "About"],
    ["contact", "Contact"],
  ];
  const checkoutOpen = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    open("checkout");
  };
  return (
    <div ref={storefrontRef} className="original-customer customer-storefront">
      <nav
        className={`navbar ${scrolled ? "scrolled" : ""}`}
        aria-label="Customer navigation"
      >
        <a href="#home" className="logo-container">
          <img
            src="/original-assets/LOGO.png"
            alt="Caballeros Logo"
            className="logo-img"
          />
          <span className="brand-name">Caballeros</span>
        </a>
        <ul className="nav-links">
          {navLinks.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="nav-link">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="nav-icons">
          <button
            type="button"
            className="cart-icon-wrapper"
            aria-label={`Shopping cart, ${count} items`}
            onClick={() => open("cart")}
          >
            <Icon name="basket-shopping" />
            <span className="storefront-cart-count" aria-hidden="true">
              {count > 99 ? "99+" : count}
            </span>
          </button>
          {user ? (
            <button
              type="button"
              aria-label="My account"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <Icon name="circle-user" />
            </button>
          ) : (
            <Link to="/login" aria-label="Sign in">
              <Icon name="circle-user" />
            </Link>
          )}
          <button
            className={`hamburger-btn ${mobileOpen ? "open" : ""}`}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="hbar" />
            <span className="hbar" />
            <span className="hbar" />
          </button>
        </div>
        <div className={`mobile-nav-drawer ${mobileOpen ? "open" : ""}`}>
          {navLinks.map(([id, label]) => (
            <a href={`#${id}`} key={id} onClick={() => setMobileOpen(false)}>
              {label}
            </a>
          ))}
        </div>
      </nav>
      {profileOpen && (
        <>
          <button
            className="profile-dropdown-overlay open"
            aria-label="Close account menu"
            onClick={() => setProfileOpen(false)}
          />
          <div className="profile-dropdown open">
            <div className="profile-dropdown-header">
              <div className="profile-avatar-small">
                <Icon name="user" />
              </div>
              <div className="profile-name">{user.fullName}</div>
              <div className="profile-email">{user.email}</div>
            </div>
            <div className="profile-dropdown-menu">
              {[
                ["profile", "circle-user", "My Profile"],
                ["security", "shield-halved", "Security"],
                ["orders", "clipboard-list", "My Orders"],
              ].map(([id, icon, label]) => (
                <button
                  key={id}
                  className="profile-dropdown-item"
                  onClick={() => open(id)}
                >
                  <Icon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
              <div className="profile-dropdown-divider" />
              <button
                className="profile-dropdown-item profile-dropdown-logout"
                onClick={logout}
              >
                <Icon name="right-from-bracket" />
                <span>LOG OUT</span>
              </button>
            </div>
          </div>
        </>
      )}
      <div id="home" className="hero-container section-fade-in visible">
        <div className="hero-content">
          <span className="storefront-eyebrow">CABALLEROS · DASMARIÑAS</span>
          <h1>
            Sizzling Good Food,
            <br />
            Delivered Hot!
          </h1>
          <div className="hero-tagline">
            Dasmariñas' Favorite Silog &amp; Sizzling Meals
          </div>
          <div className="hero-subtitle">
            Lutong-Bahay Delivered to your Doorstep
          </div>
          <div className="hero-description">
            Your silog favorites, sizzling plates, and comforting Filipino
            flavors. Find your craving and make it a Caballeros meal.
          </div>
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
              setSelectedCategory("All");
              document
                .getElementById("menu")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Icon name="magnifying-glass" />
            <input
              className="search-input"
              aria-label="Search food"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for Tapsilog, Sisig, or your Favorite..."
            />
            <button className="btn-search">Search</button>
          </form>
          <div className="cta-group">
            <a className="btn-order" href="#menu">
              Explore the Menu <Icon name="arrow-right" />
            </a>
          </div>
          <div className="storefront-benefits">
            <span>
              <Icon name="utensils" /> Filipino comfort food
            </span>
            <span>
              <Icon name="motorcycle" /> Delivered in Dasmariñas
            </span>
            <span>
              <Icon name="gift" /> Free delivery from ₱500
            </span>
          </div>
        </div>
      </div>
      <section
        id="menu"
        className="menu-display-section section-fade-in visible"
      >
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
      <StaticSection name="about" />
      <StaticSection name="love" />
      <StaticSection name="steps" />
      <FindUs />
      {scrolled && (
        <button
          className="back-to-top-btn"
          aria-label="Back to top"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            })
          }
        >
          <Icon name="arrow-up" />
        </button>
      )}
      <StaticSection
        name="footer"
        onClick={(event) => {
          const target = event.target.closest("a");
          if (
            target?.id === "termsFooterLink" ||
            target?.id === "privacyFooterLink"
          ) {
            event.preventDefault();
            open(target.id === "termsFooterLink" ? "terms" : "privacy");
          }
        }}
      />
      {success && !dialog && (
        <div className="migration-toast" role="status">
          <Icon name="cart-plus" />
          <span>{success}</span>
          <button aria-label="Dismiss message" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}
      {dialog === "sign-in-required" && (
        <Modal title="Sign in to start your order" onClose={close}>
          <div className="guest-order-prompt">
            <span className="guest-order-icon">
              <Icon name="utensils" />
            </span>
            <h3>Your next favorite is waiting.</h3>
            <p>
              Sign in or create an account to add meals to your cart and place
              your Caballeros order.
            </p>
            <div className="migration-form-actions">
              <Link className="migration-button primary" to="/login">
                Sign In
              </Link>
              <Link className="migration-button gold" to="/register">
                Create Account
              </Link>
            </div>
            <button className="text-link" onClick={close}>
              Keep browsing the menu
            </button>
          </div>
        </Modal>
      )}
      {dialog === "cart" && (
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
                Delivery fee is based on your barangay. Free delivery on orders
                over ₱500.
              </span>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "checkout" && (
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
                      {method.instructions && (
                        <small>{method.instructions}</small>
                      )}
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
              disabled={
                busy || !lines.length || !methods.length || !fees.length
              }
            >
              {busy ? "Placing order…" : "Confirm Order"}
            </button>
          </form>
        </Modal>
      )}
      {dialog === "orders" && (
        <Modal title="My Orders" onClose={close} wide>
          <Notice error={error} success={success} />
          {["Active Orders", "Order History"].map((heading, index) => (
            <div key={heading}>
              <h3 className="migration-subheading">{heading}</h3>
              {orders
                .filter((o) =>
                  index === 0
                    ? !["Completed", "Cancelled"].includes(o.status)
                    : ["Completed", "Cancelled"].includes(o.status),
                )
                .map((order) => (
                  <div className="order-card" key={order.id}>
                    <div className="migration-order-row">
                      <div>
                        <strong>Order #: {order.ticket_number}</strong>
                        <br />
                        <small>{dateTime(order.created_at)}</small>
                        <p>Delivery to: {order.delivery_address}</p>
                        <strong>Total: {money(order.total_amount)}</strong>
                      </div>
                      <div>
                        <Badge value={order.status} />
                        <button
                          className="migration-button"
                          onClick={() => open({ kind: "order", order })}
                        >
                          <Icon name="eye" /> Details, Proofs &amp; Rating
                        </button>
                        {order.status === "Open" && (
                          <button
                            className="btn-cancel"
                            disabled={busy}
                            onClick={() => cancel(order.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ))}
          {!orders.length && (
            <Empty
              title="No orders yet"
              detail="Browse the menu to place your first order."
            />
          )}
        </Modal>
      )}
      {dialog === "profile" && profile && (
        <Modal title="My Profile" onClose={close} wide>
          <AccountProfile
            profile={profile}
            onSaved={(next) => {
              setProfile(next);
              setCheckout((previous) => ({
                ...previous,
                deliveryAddress: next.address || "",
                barangayName:
                  next.address_details?.barangay || previous.barangayName,
              }));
            }}
          />
        </Modal>
      )}
      {dialog === "security" && (
        <Modal title="Security — Change Password" onClose={close}>
          <form className="migration-form" onSubmit={changePassword}>
            <Notice error={error} success={success} />
            <label>
              Current Password
              <PasswordInput
                visibilityLabel="current password"
                aria-label="Current Password"
                autoComplete="current-password"
                required
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    currentPassword: e.target.value,
                  })
                }
              />
            </label>
            <label>
              New Password
              <PasswordInput
                visibilityLabel="new password"
                aria-label="New Password"
                autoComplete="new-password"
                minLength={12}
                pattern={passwordPattern}
                title={passwordHelp}
                required
                value={passwords.newPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, newPassword: e.target.value })
                }
              />
            </label>
            <button className="migration-button primary" disabled={busy}>
              Change Password
            </button>
          </form>
        </Modal>
      )}
      {dialog?.kind === "order" && (
        <OrderDetails
          order={dialog.order}
          onClose={close}
          onChanged={async () => setOrders((await api("/api/orders")).items)}
          onReorder={(items) => {
            let skipped = 0;
            for (const item of items) {
              const product = menu.find(
                (product) => String(product.id) === String(item.menu_id),
              );
              if (product)
                updateCart(
                  product,
                  Math.ceil(Number(item.quantity)),
                  item.special_instructions || "",
                );
              else skipped++;
            }
            setDialog("cart");
            setSuccess(
              skipped
                ? "Available items added; some old items are no longer available."
                : "Items added to your cart at current prices.",
            );
          }}
        />
      )}
      {dialog?.food_name && (
        <MealDetails
          meal={dialog}
          onClose={close}
          onAdd={(meal, quantity, instructions) => {
            if (!updateCart(meal, quantity, instructions)) return;
            setSuccess(meal.food_name + " added to your order.");
            close();
          }}
        />
      )}
      {["terms", "privacy"].includes(dialog) && (
        <Modal
          title={dialog === "terms" ? "Terms & Conditions" : "Privacy Policy"}
          onClose={close}
        >
          <p>
            {dialog === "terms"
              ? "TasteNet provides food ordering and delivery within Dasmariñas City. Prices and delivery fees are shown before confirmation. Open orders may be cancelled from My Orders. Contact Caballeros for help with an order or payment."
              : "TasteNet uses your account information and delivery address to process your orders, deliver meals, and communicate with you. Contact Caballeros for questions about your account information."}
          </p>
        </Modal>
      )}
    </div>
  );
}
