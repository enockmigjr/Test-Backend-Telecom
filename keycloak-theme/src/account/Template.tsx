import { clsx } from "keycloakify/tools/clsx";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { getKcClsx } from "keycloakify/account/lib/kcClsx";
import { useSetClassName } from "keycloakify/tools/useSetClassName";
import { useInitialize } from "keycloakify/account/Template.useInitialize";
import type { KcContext } from "./KcContext";
import type { I18n } from "./i18n";
import type { TemplateProps } from "keycloakify/account/TemplateProps";

/**
 * Gabarit de la console de compte, décliné aux couleurs de l'app
 * (bleu nuit #172033 + accent #1d4ed8), comme la page de login.
 */
export default function Template(props: TemplateProps<KcContext, I18n>) {
  const { kcContext, i18n, doUseDefaultCss, active, classes, children } = props;
  const { kcClsx } = getKcClsx({ doUseDefaultCss, classes });
  const { msg, currentLanguage, enabledLanguages } = i18n;
  const { url, features, realm, message, referrer } = kcContext;

  useSetClassName({ qualifiedName: "html", className: kcClsx("kcHtmlClass") });
  useSetClassName({
    qualifiedName: "body",
    className: clsx("admin-console", "user", "kc-account-body", kcClsx("kcBodyClass")),
  });

  const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });
  if (!isReadyToRender) return null;

  return (
    <>
      <header className="navbar navbar-default navbar-pf navbar-main header kc-account-header">
        <nav className="navbar" role="navigation">
          <div className="navbar-header">
            <div className="container">
              <h1 className="navbar-title">
                <span className="kc-account-brand">
                  <span className="kc-account-brand-dot" aria-hidden />
                  Helpdesk Telecom
                </span>
              </h1>
            </div>
          </div>
          <div className="navbar-collapse navbar-collapse-1">
            <div className="container">
              <ul className="nav navbar-nav navbar-utility">
                {enabledLanguages.length > 1 && (
                  <li>
                    <div className="kc-dropdown" id="kc-locale-dropdown">
                      <a href="#" id="kc-current-locale-link">
                        {currentLanguage.label}
                      </a>
                      <ul>
                        {enabledLanguages.map(({ languageTag, label, href }) => (
                          <li className="kc-dropdown-item" key={languageTag}>
                            <a href={href}>{label}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                )}
                {referrer?.url && (
                  <li>
                    <a href={referrer.url} id="referrer">
                      {msg("backTo", referrer.name)}
                    </a>
                  </li>
                )}
                <li>
                  <a href={url.getLogoutUrl()}>{msg("doSignOut")}</a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>
      <div className="container kc-account-shell">
        <div className="bs-sidebar col-sm-3 kc-account-sidebar">
          <ul className="kc-account-nav">
            <li className={clsx(active === "account" && "active")}>
              <a href={url.accountUrl}>{msg("account")}</a>
            </li>
            {features.passwordUpdateSupported && (
              <li className={clsx(active === "password" && "active")}>
                <a href={url.passwordUrl}>{msg("password")}</a>
              </li>
            )}
            <li className={clsx(active === "totp" && "active")}>
              <a href={url.totpUrl}>{msg("authenticator")}</a>
            </li>
            {features.identityFederation && (
              <li className={clsx(active === "social" && "active")}>
                <a href={url.socialUrl}>{msg("federatedIdentity")}</a>
              </li>
            )}
            <li className={clsx(active === "sessions" && "active")}>
              <a href={url.sessionsUrl}>{msg("sessions")}</a>
            </li>
            {/*
              « Applications » masqué : la page applications.ftl de la console
              Account v1 renvoie 500 sur Keycloak 26.x (ApplicationsBean référence
              AdminPermissions, classe retirée ; issue amont fermée « not planned »,
              non corrigée même en 26.7.1). La console v2 par défaut est la seule
              à servir cette page ; on préfère garder le thème uniforme.
            */}
            {features.log && (
              <li className={clsx(active === "log" && "active")}>
                <a href={url.logUrl}>{msg("log")}</a>
              </li>
            )}
            {realm.userManagedAccessAllowed && features.authorization && (
              <li className={clsx(active === "authorization" && "active")}>
                <a href={url.resourceUrl}>{msg("myResources")}</a>
              </li>
            )}
          </ul>
        </div>
        <div className="col-sm-9 content-area kc-account-content">
          {message !== undefined && (
            <div className={clsx("alert", `alert-${message.type}`)}>
              {message.type === "success" && <span className="pficon pficon-ok" />}
              {message.type === "error" && <span className="pficon pficon-error-circle-o" />}
              <span
                className="kc-feedback-text"
                dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }}
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
