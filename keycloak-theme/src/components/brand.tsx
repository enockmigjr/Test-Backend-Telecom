const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

/** Marque unique « KAMGOKO ITSM » : logo + wordmark, partagée login et compte. */
export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={inverted ? 'kc-brand kc-brand--inverted' : 'kc-brand'}>
      <img className="kc-brand-logo" src={logoUrl} alt="" width={44} height={44} />
      <span className="kc-brand-wordmark">
        KAMGOKO <span className="kc-brand-accent">ITSM</span>
      </span>
    </span>
  );
}
