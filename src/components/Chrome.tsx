import { useLanguage } from '../i18n';
import type { ReactNode } from 'react';
import { navigate } from '../api';
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    pulse: <path d="M2 12h4l3-8 5 16 3-8h5" />,
    chart: (
      <>
        <path d="M4 3v17h17" />
        <path d="m7 15 4-5 4 2 5-7" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    shield: (
      <>
        <path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
    check: <path d="m5 12 4 4L20 5" />,
    file: (
      <>
        <path d="M5 3h9l5 5v13H5Z" />
        <path d="M14 3v6h5M8 13h8M8 17h6" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 3a5 5 0 0 1 2 4v4" />
      </>
    ),
    link: (
      <>
        <path d="m10 14 4-4m-6 3-3 3a4 4 0 0 0 6 6l3-3m2-8 3-3a4 4 0 0 0-6-6l-3 3" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
export function Brand() {
  const { t } = useLanguage();

  return (
    <a
      className="brand"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate('/');
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M4 12 16 5l12 7v8l-12 7-12-7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m4 12 12 7 12-7M16 19v8M10 9v8l12 7M22 9v8l-12 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span>
        {t('CORTEX')}
        <small>{t('PERFORMANCE LABORATORY')}</small>
      </span>
    </a>
  );
}
export function Shell({
  children,
  active = 'Workspace',
  admin = false,
  onNav,
}: {
  children: ReactNode;
  active?: string;
  admin?: boolean;
  onNav?: (v: string) => void;
}) {
  const { t } = useLanguage();

  const items = admin
    ? [
        ['grid', 'Dashboard'],
        ['people', 'Sessions'],
        ['pulse', 'Active Sessions'],
        ['file', 'Result Profiles'],
        ['link', 'Invite Links'],
        ['settings', 'Preset Editor'],
        ['chart', 'Results'],
        ['shield', 'Reveal Controls'],
        ['settings', 'System Status'],
      ]
    : [
        ['grid', 'Workspace'],
        ['pulse', 'Assessment'],
        ['chart', 'Results'],
        ['file', 'Protocol'],
      ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('Skip to content')}
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="rail-label">{admin ? t('OPERATOR CONSOLE') : t('PARTICIPANT PORTAL')}</div>
        <nav>
          {items.map(([icon, label]) => (
            <button
              key={label}
              className={active === label ? 'nav-item active' : 'nav-item'}
              onClick={() =>
                onNav
                  ? onNav(label)
                  : navigate(
                      label === 'Workspace'
                        ? '/'
                        : label === 'Assessment'
                          ? '/assessment'
                          : label === 'Results'
                            ? '/results'
                            : '/protocol',
                    )
              }
              aria-current={active === label ? 'page' : undefined}
            >
              <Icon name={icon} />
              {t(label)}
              {active === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="rail-status">
            <span className="status-dot" /> {t(' Laboratory online')}
          </div>
          <p>{t('ENGINE 01 / PROTOCOL K-17')}</p>
          <a
            href={admin ? '/' : '/admin'}
            onClick={(e) => {
              e.preventDefault();
              navigate(admin ? '/' : '/admin');
            }}
          >
            <Icon name="shield" size={15} />
            {admin ? t('Participant portal') : t('Operator access')}
            <span>↗</span>
          </a>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <span className="breadcrumb">
            {admin ? t('Console') : t('Laboratory')} <span>/</span> <b>{t(active)}</b>
          </span>
          <div className="top-status">
            <span className="status-dot" /> {t(' All systems operational')}{' '}
            <span className="version">{t('v1.0')}</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer>
          <span>{t('CORTEX / Cognitive & Operational Response Testing EXamination')}</span>
          <span>{t('Entertainment assessment · No diagnostic validity')}</span>
        </footer>
      </div>
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{t(eyebrow)}</div>
        <h1>{t(title)}</h1>
        {description && <p>{t(description)}</p>}
      </div>
      {action}
    </div>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function ErrorNote({ error }: { error: string }) {
  const { t } = useLanguage();

  return error ? (
    <div role="alert" className="error-note">
      {t(error)}
    </div>
  ) : null;
}
