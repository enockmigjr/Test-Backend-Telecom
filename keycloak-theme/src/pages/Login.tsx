import { AuthLayout } from '../components/auth-layout';
import type { KcContext } from '../login/KcContext';

export function Login({ kcContext }: { kcContext: Extract<KcContext, { pageId: 'login.ftl' }> }) {
  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre espace avec votre compte professionnel.">
      {kcContext.message?.type === 'error' ? <div className="kc-alert">{kcContext.message.summary}</div> : null}
      <form action={kcContext.url.loginAction} method="post">
        <div className="kc-field">
          <label htmlFor="username">Adresse e-mail</label>
          <input
            className="kc-input"
            id="username"
            name="username"
            type="text"
            autoFocus
            defaultValue={kcContext.login.username ?? ''}
          />
        </div>
        <div className="kc-field">
          <label htmlFor="password">Mot de passe</label>
          <input className="kc-input" id="password" name="password" type="password" />
        </div>
        <button className="kc-button" type="submit" name="login" value="login">
          Se connecter
        </button>
      </form>
    </AuthLayout>
  );
}
