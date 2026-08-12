import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { kcContext } from "./kcContext";
import { KcApp } from "./KcApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KcApp kcContext={kcContext} />
  </StrictMode>,
);
