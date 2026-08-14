import { useState } from "react";
import type { KcContext } from "../login/KcContext";
import type { I18n } from "../login/i18n";

/** Page de changement de mot de passe, déclinée avec la charte du login. */
export function LoginUpdatePassword(props: {
  kcContext: Extract<KcContext, { pageId: "login-update-password.ftl" }>;
  i18n: I18n;
}) {
  const { kcContext, i18n } = props;
  const { msg, msgStr } = i18n;
  const { url, messagesPerField, isAppInitiatedAction } = kcContext;
  const [revealed, setRevealed] = useState(false);

  const hasError = messagesPerField.existsError("password", "password-confirm");

  return (
    <div className="kc-shell">
      <div className="kc-card">
        <div className="kc-brand">
          <span className="kc-brand-dot" aria-hidden />
          Telecom Ticket Management
        </div>
        <h1 className="kc-title">{msg("updatePasswordTitle")}</h1>
        <p className="kc-subtitle">Définissez votre nouveau mot de passe.</p>
        {hasError ? <div className="kc-alert">{msg("invalidPasswordMessage")}</div> : null}
        <form action={url.loginAction} method="post">
          <div className="kc-field">
            <label htmlFor="password-new">{msg("passwordNew")}</label>
            <input
              className="kc-input"
              id="password-new"
              name="password-new"
              type={revealed ? "text" : "password"}
              autoFocus
              autoComplete="new-password"
              aria-invalid={messagesPerField.existsError("password")}
            />
            {messagesPerField.existsError("password") ? (
              <span className="kc-field-error" id="input-error-password">
                {messagesPerField.get("password")}
              </span>
            ) : null}
          </div>
          <div className="kc-field">
            <label htmlFor="password-confirm">{msg("passwordConfirm")}</label>
            <input
              className="kc-input"
              id="password-confirm"
              name="password-confirm"
              type={revealed ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={messagesPerField.existsError("password-confirm")}
            />
            {messagesPerField.existsError("password-confirm") ? (
              <span className="kc-field-error" id="input-error-password-confirm">
                {messagesPerField.get("password-confirm")}
              </span>
            ) : null}
          </div>
          <label className="kc-check">
            <input
              type="checkbox"
              checked={revealed}
              onChange={(event) => setRevealed(event.target.checked)}
            />
            {msg("showPassword")}
          </label>
          <label className="kc-check">
            <input type="checkbox" id="logout-sessions" name="logout-sessions" value="on" />
            {msg("logoutOtherSessions")}
          </label>
          <div className="kc-actions">
            <button className="kc-button" type="submit">
              {msgStr("doSubmit")}
            </button>
            {isAppInitiatedAction ? (
              <button className="kc-button kc-button-ghost" type="submit" name="cancel-aia" value="true">
                {msg("doCancel")}
              </button>
            ) : null}
          </div>
        </form>
        <p className="kc-footer">Portail incidents télécom — SSO sécurisé</p>
      </div>
    </div>
  );
}
