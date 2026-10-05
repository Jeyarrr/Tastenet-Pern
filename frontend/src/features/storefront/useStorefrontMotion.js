import { useEffect, useRef } from "react";

// Animate content, never the fixed navigation or an ancestor of a dialog.
const targets = [
  ".hero-content > *",
  ".storefront-menu-heading",
  ".menu-category-tabs",
  ".menu-search-summary",
  ".category-title",
  ".menu-container",
  ".about-title",
  ".content-box",
  ".love-us-title",
  ".feature-card",
  ".compact-steps-header",
  ".compact-step-card",
  ".cta-banner",
  ".find-us-intro",
  ".find-us-layout",
  ".footer-logo-section",
  ".footer-quick-links",
  ".footer-bottom",
].join(", ");

export function useStorefrontMotion() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !window.IntersectionObserver) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer;
    let mutations;
    const tracked = new Set();

    const reveal = (element) => {
      element.classList.add("is-revealed");
      observer?.unobserve(element);
    };
    const register = (element) => {
      if (tracked.has(element)) return;
      tracked.add(element);
      const siblings = [...element.parentElement.children];
      const staggered = element.matches(
        ".hero-content > *, .menu-container, .feature-card, .compact-step-card",
      );
      const delay = staggered ? Math.min(siblings.indexOf(element), 4) * 65 : 0;
      element.style.setProperty("--reveal-delay", `${delay}ms`);
      element.classList.add("storefront-reveal");
      // Content above a restored scroll position must remain visible.
      if (element.getBoundingClientRect().bottom < 0) reveal(element);
      else observer.observe(element);
    };
    const clear = () => {
      observer?.disconnect();
      mutations?.disconnect();
      for (const element of tracked) {
        element.classList.remove("storefront-reveal", "is-revealed");
        element.style.removeProperty("--reveal-delay");
      }
      tracked.clear();
    };
    const start = () => {
      clear();
      if (preference.matches) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) reveal(entry.target);
          }
        },
        { threshold: 0, rootMargin: "0px 0px -24px 0px" },
      );
      root.querySelectorAll(targets).forEach(register);
      // Menu items arrive asynchronously and change when filtering/searching.
      mutations = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches(targets)) register(node);
            node.querySelectorAll(targets).forEach(register);
          }
        }
        for (const element of tracked) {
          if (!root.contains(element)) {
            observer.unobserve(element);
            tracked.delete(element);
          }
        }
      });
      mutations.observe(root, { childList: true, subtree: true });
    };
    // Focused controls skip the decorative entrance effect.
    const onFocus = (event) => {
      const element = event.target.closest(".storefront-reveal");
      if (element) reveal(element);
    };
    start();
    preference.addEventListener("change", start);
    root.addEventListener("focusin", onFocus);
    return () => {
      clear();
      preference.removeEventListener("change", start);
      root.removeEventListener("focusin", onFocus);
    };
  }, []);

  return rootRef;
}
