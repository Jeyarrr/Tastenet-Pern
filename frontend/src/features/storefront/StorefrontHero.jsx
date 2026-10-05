import { Icon } from "../../components/ui/Icon.jsx";

export function StorefrontHero({
  search,
  setSearch,
  setQuery,
  setSelectedCategory,
}) {
  return (
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
  );
}
