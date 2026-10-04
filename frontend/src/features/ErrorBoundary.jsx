import { Component } from "react";

export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("TasteNet page failed:", error);
  }
  render() {
    return this.state.failed ? (
      <main className="screen-loader">
        <section className="migration-card" role="alert">
          <h1>This page could not load</h1>
          <p>
            Reload TasteNet to try again. Your saved records are kept in the
            database.
          </p>
          <button
            className="migration-button primary"
            onClick={() => window.location.reload()}
          >
            Reload TasteNet
          </button>
        </section>
      </main>
    ) : (
      this.props.children
    );
  }
}
