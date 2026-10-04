import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./interactions.css";
import "./features/workflows.css";

// Reuse the root if Vite reloads the entry module during development.
const root =
  import.meta.hot?.data.root ?? createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
