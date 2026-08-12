import type { KcContext } from "keycloakify";
import { Login } from "./pages/Login";
import { ErrorPage } from "./pages/Error";
import { Info } from "./pages/Info";

export function KcApp({ kcContext }: { kcContext: KcContext }) {
  switch (kcContext.pageId) {
    case "login.ftl":
      return <Login kcContext={kcContext} />;
    case "error.ftl":
      return <ErrorPage kcContext={kcContext} />;
    case "info.ftl":
      return <Info kcContext={kcContext} />;
    default:
      return null; // Les autres pages utilisent le thème par défaut de Keycloak.
  }
}
