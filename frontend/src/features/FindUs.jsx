import { Icon } from "../components.jsx";
import sections from "../original/website-sections.json";

const mapSource = /src="([^"]+)"/.exec(sections.contact)?.[1];
export function FindUs() {
  return (
    <section id="contact" className="storefront-find-us">
      <div className="find-us-intro">
        <span className="storefront-eyebrow">GOOD FOOD, CLOSE TO HOME</span>
        <h2>
          Come hungry.
          <br />
          Leave happy.
        </h2>
        <p>
          Your table at Caballeros is waiting. Drop by for your favorites, or
          give us a call.
        </p>
      </div>
      <div className="find-us-layout">
        <div className="find-us-details">
          <h3>Find us in Dasmariñas</h3>
          <div className="find-us-detail">
            <span>
              <Icon name="location-dot" />
            </span>
            <div>
              <strong>Visit Caballeros</strong>
              <p>
                Blk 84, Lot 10 Bautista St, Zone 9<br />
                Dasmariñas, 4114 Cavite
              </p>
            </div>
          </div>
          <div className="find-us-detail">
            <span>
              <Icon name="clock" />
            </span>
            <div>
              <strong>Every day, for every craving</strong>
              <p>
                Monday – Sunday
                <br />
                10:00 AM – 9:00 PM
              </p>
            </div>
          </div>
          <div className="find-us-detail">
            <span>
              <Icon name="phone" />
            </span>
            <div>
              <strong>Let’s talk food</strong>
              <a href="tel:0464739753">046-473-9753</a>
              <a href="tel:+639123687369">0912-368-7369</a>
            </div>
          </div>
          <a
            className="migration-button primary"
            href="https://www.google.com/maps/dir/?api=1&destination=14.32649854666237%2C120.9372845304983"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="directions" /> Get Directions
          </a>
        </div>
        <div className="find-us-map">
          <iframe
            title="Caballeros Location"
            src={mapSource}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <span className="find-us-map-caption">
            <Icon name="location-dot" /> A taste of home, right here.
          </span>
        </div>
      </div>
    </section>
  );
}
