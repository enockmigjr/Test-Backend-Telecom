import { useEffect, type ReactNode } from 'react';

import { Brand } from './brand';

/** Coquille commune des pages login : carte centrée, marque, titre et pied. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: Readonly<{
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
}>) {
  useEffect(() => {
    document.title = typeof title === 'string' ? `KAMGOKO ITSM — ${title}` : 'KAMGOKO ITSM';
  }, [title]);

  return (
    <div className="kc-shell">
      <div className="kc-card">
        <Brand />
        <h1 className="kc-title">{title}</h1>
        {subtitle ? <p className="kc-subtitle">{subtitle}</p> : null}
        {children}
        {footer ?? <p className="kc-footer">KAMGOKO ITSM — SSO sécurisé</p>}
      </div>
    </div>
  );
}
