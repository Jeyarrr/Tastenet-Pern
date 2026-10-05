import { CustomerOrdersDialog } from "../features/orders/CustomerOrdersDialog.jsx";
import { CheckoutDialog } from "../features/cart/CheckoutDialog.jsx";
import { CartDialog } from "../features/cart/CartDialog.jsx";
import { StorefrontNavigation } from "../features/storefront/StorefrontNavigation.jsx";
import { StorefrontMenu } from "../features/storefront/StorefrontMenu.jsx";
import { StorefrontHero } from "../features/storefront/StorefrontHero.jsx";
import { AccountProfile } from "../features/accounts/AccountProfile.jsx";
import { FindUs } from "../features/storefront/FindUs.jsx";
import { passwordPattern, passwordHelp } from "../lib/passwordPolicy.js";
import { PasswordInput } from "../components/forms/PasswordInput.jsx";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

import { useAuth } from "../features/auth/AuthProvider.jsx";
import { Notice } from "../components/ui/Feedback.jsx";
import { Icon } from "../components/ui/Icon.jsx";

import { Modal } from "../components/ui/Modal.jsx";
import { useCart } from "../features/cart/useCart.js";
import { OrderDetails } from "../features/orders/OrderDetails.jsx";
import { MealDetails } from "../features/catalog/MealDetails.jsx";

import sections from "../original/website-sections.json";

import { useStorefrontMotion } from "../features/storefront/useStorefrontMotion.js";

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
  const { user, logout } = useAuth();
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
      <StorefrontNavigation
        user={user}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        scrolled={scrolled}
        open={open}
        count={count}
        navLinks={navLinks}
      />
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
      <StorefrontHero
        search={search}
        setSearch={setSearch}
        setQuery={setQuery}
        setSelectedCategory={setSelectedCategory}
      />
      <StorefrontMenu
        setSearch={setSearch}
        query={query}
        setQuery={setQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        dialog={dialog}
        error={error}
        setSuccess={setSuccess}
        loading={loading}
        open={open}
        updateCart={updateCart}
        categories={categories}
        filtered={filtered}
      />
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
        <CartDialog
          setCart={setCart}
          close={close}
          updateCart={updateCart}
          lines={lines}
          count={count}
          subtotal={subtotal}
          delivery={delivery}
          checkoutOpen={checkoutOpen}
        />
      )}
      {dialog === "checkout" && (
        <CheckoutDialog
          fees={fees}
          methods={methods}
          checkout={checkout}
          setCheckout={setCheckout}
          error={error}
          busy={busy}
          close={close}
          lines={lines}
          subtotal={subtotal}
          delivery={delivery}
          placeOrder={placeOrder}
        />
      )}
      {dialog === "orders" && (
        <CustomerOrdersDialog
          orders={orders}
          error={error}
          success={success}
          busy={busy}
          close={close}
          open={open}
          cancel={cancel}
        />
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
