import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KcPage } from './kc.gen';
import './styles.css';
import './login-styles.css';
import './account-styles.css';

if (window.kcContext !== undefined) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <KcPage kcContext={window.kcContext} />
    </StrictMode>,
  );
}
