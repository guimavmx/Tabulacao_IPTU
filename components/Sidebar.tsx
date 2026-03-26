export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-text">
          IPTU<span>Extractor</span>
        </div>
        <div className="sidebar-logo-sub">PDF → Excel · AI Powered</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">Ferramenta</div>

        <a href="/" className="sidebar-item active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          Dashboard
        </a>

        <hr className="sidebar-divider" />
        <div className="sidebar-section">Suporte</div>

        <a
          href="https://docs.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-item"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
          Documentação IA
        </a>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-badge">Trinus · v1.1</span>
      </div>
    </aside>
  );
}
