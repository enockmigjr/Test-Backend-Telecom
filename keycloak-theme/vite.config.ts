import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { keycloakify } from "keycloakify/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      // Console de compte personnalisée aux couleurs de l'app (comme le login).
      accountThemeImplementation: "Multi-Page",
    }),
  ],
});
