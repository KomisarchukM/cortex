import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import { LanguageProvider, useLanguage } from './i18n';
import './styles.css';
import './instrument-enhancements.css';
import './localization.css';
import Workspace from './pages/Workspace';
const Assessment = lazy(() => import('./pages/Assessment'));
const Results = lazy(() => import('./pages/Results'));
const Admin = lazy(() => import('./pages/Admin'));
class Boundary extends React.Component<
  { children: React.ReactNode; t: (value: string) => string },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>{this.props.t('The console needs a reload.')}</h1>
        <p>{this.props.t('Your saved responses are retained.')}</p>
        <button onClick={() => location.reload()}>{this.props.t('Reload')}</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const { t } = useLanguage();
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const change = () => {
      setPath(location.pathname);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#main')?.focus());
    };
    window.addEventListener('popstate', change);
    return () => window.removeEventListener('popstate', change);
  }, []);
  return (
    <Boundary t={t}>
      <Suspense fallback={<div className="loading">{t('Initializing laboratory…')}</div>}>
        {path.startsWith('/admin') ? (
          <LanguageProvider fixed="en">
            <Admin />
          </LanguageProvider>
        ) : path === '/results' || path === '/reveal' ? (
          <Results reveal={path === '/reveal'} />
        ) : path === '/assessment' ? (
          <Assessment />
        ) : (
          <Workspace
            protocol={path === '/protocol'}
            invite={path.startsWith('/assessment/start/') ? path.split('/').at(-1) : undefined}
          />
        )}
      </Suspense>
    </Boundary>
  );
}
createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
);
