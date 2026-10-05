import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon.jsx";

export function StorefrontNavigation({
  user,
  profileOpen,
  setProfileOpen,
  mobileOpen,
  setMobileOpen,
  scrolled,
  open,
  count,
  navLinks,
}) {
  return (
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
  );
}
