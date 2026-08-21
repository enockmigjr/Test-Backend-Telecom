import { AuthLayout } from '../components/auth-layout';
import type { KcContext } from '../login/KcContext';

export function ErrorPage({ kcContext }: { kcContext: Extract<KcContext, { pageId: 'error.ftl' }> }) {
  // En contexte console de compte, `loginAction` peut être absent : on retombe
  // sur la page de connexion du compte, sinon sur l'accueil.
  const backHref = kcContext.url.loginAction ?? kcContext.url.loginUrl ?? '/';
  return (
    <AuthLayout title="Une erreur est survenue" footer={<a href={backHref}>Retour à la connexion</a>}>
      <div className="kc-alert">{kcContext.message.summary}</div>
    </AuthLayout>
  );
}
