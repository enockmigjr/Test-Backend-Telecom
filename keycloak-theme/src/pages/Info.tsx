import type { KcContext } from "keycloakify";

export function Info({ kcContext }: { kcContext: Extract<KcContext, { pageId: "info.ftl" }> }) {
  return (
    <div className="kc-shell">
      <div className="kc-card">
        <div className="kc-brand"><span className="kc-brand-dot" /> Telecom Ticket Management</div>
        <h1 className="kc-title">{kcContext.message.summary}</h1>
        {kcContext.skipLink ? null : (
          <p className="kc-footer"><a href={kcContext.url.loginAction}>Retour à la connexion</a></p>
        )}
      </div>
    </div>
  );
}
