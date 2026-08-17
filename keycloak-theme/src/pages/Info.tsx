import { AuthLayout } from '../components/auth-layout';
import type { KcContext } from '../login/KcContext';

export function Info({ kcContext }: { kcContext: Extract<KcContext, { pageId: 'info.ftl' }> }) {
  return (
    <AuthLayout
      title={kcContext.message?.summary ?? 'Information'}
      footer={
        kcContext.skipLink ? undefined : (
          <a href={kcContext.url.loginAction}>Retour à la connexion</a>
        )
      }
    />
  );
}
