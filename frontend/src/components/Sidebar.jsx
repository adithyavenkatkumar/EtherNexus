import React from 'react';

const NAV_ITEMS = [
  { id: 'main',      icon: '⊞',  label: 'Dashboard' },
  { id: 'analytics', icon: '↗',  label: 'Analytics' },
  { id: 'multisig',  icon: '⊡',  label: 'Multi-Signature' },
  { id: 'recurring', icon: '↺',  label: 'Recurring Payments' },
  { id: 'gas',       icon: '◎',  label: 'Gas Estimator' },
  { id: 'admin',     icon: '⊛',  label: 'Admin Panel' },
];

const Sidebar = ({ activeView, setActiveView }) => (
  <aside className="app-sidebar">
    <div className="sidebar-logo">
      <div className="sidebar-logo-icon">E</div>
      <span className="sidebar-logo-text">EtherNexus</span>
    </div>

    <nav className="sidebar-nav">
      <span className="sidebar-label">Menu</span>
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item${activeView === item.id ? ' active' : ''}`}
          onClick={() => setActiveView(item.id)}
          title={item.label}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>

    <div className="sidebar-footer">v1.0 · Sepolia</div>
  </aside>
);

export default Sidebar;
