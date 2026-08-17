import { AuthLayout } from '../components/auth-layout';
import type { KcContext } from '../login/KcContext';

/** Page de confirmation de déconnexion, déclinée avec la charte du login. */
export function LogoutConfirm({ kcContext }: { kcContext: Extract<KcContext, { pageId: 'logout-confirm.ftl' }> }) {
  return (
    <AuthLayout title="Déconnexion" subtitle="Voulez-vous vraiment vous déconnecter de votre espace ?">
      <form action={kcContext.url.logoutConfirmAction} method="post">
        <button className="kc-button" type="submit" name="confirmLogout" value="yes">
          Se déconnecter
        </button>
      </form>
      <div className="kc-footer">
        <a href={kcContext.url.loginUrl}>Annuler</a>
      </div>
    </AuthLayout>
  );
}
