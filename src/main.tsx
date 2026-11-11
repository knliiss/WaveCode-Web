import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { App } from "./app/App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("WaveCode app root not found.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
