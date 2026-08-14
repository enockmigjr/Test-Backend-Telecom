import type { KcContext } from "../login/KcContext";

export function ErrorPage({ kcContext }: { kcContext: Extract<KcContext, { pageId: "error.ftl" }> }) {
  // En contexte console de compte, `loginAction` peut être absent : on retombe
  // sur la page de connexion du compte, sinon sur l'accueil.
  const backHref = kcContext.url.loginAction ?? kcContext.url.loginUrl ?? "/";
  return (
    <div className="kc-shell">
      <div className="kc-card">
        <div className="kc-brand"><span className="kc-brand-dot" /> Telecom Ticket Management</div>
        <h1 className="kc-title">Une erreur est survenue</h1>
        <div className="kc-alert">{kcContext.message.summary}</div>
        <p className="kc-footer"><a href={backHref}>Retour à la connexion</a></p>
      </div>
    </div>
  );
}
