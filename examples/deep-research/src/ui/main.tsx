import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./webchat";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
