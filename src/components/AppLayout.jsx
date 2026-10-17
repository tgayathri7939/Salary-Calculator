import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopHeader from './TopHeader.jsx';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-content" id="main-content" tabIndex={-1}>
        <TopHeader
          onMenuToggle={() => setSidebarOpen(p => !p)}
          currentPath={location.pathname}
        />
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
