import type { KcContext } from "keycloakify";

export function ErrorPage({ kcContext }: { kcContext: Extract<KcContext, { pageId: "error.ftl" }> }) {
  return (
    <div className="kc-shell">
      <div className="kc-card">
        <div className="kc-brand"><span className="kc-brand-dot" /> Telecom Ticket Management</div>
        <h1 className="kc-title">Une erreur est survenue</h1>
        <div className="kc-alert">{kcContext.message.summary}</div>
        <p className="kc-footer"><a href={kcContext.url.loginAction}>Retour à la connexion</a></p>
      </div>
    </div>
  );
}
