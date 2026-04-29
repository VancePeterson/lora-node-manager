import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import Dashboard from './pages/Dashboard';
import Nodes from './pages/Nodes';
import NodeDetail from './pages/NodeDetail';
import Network from './pages/Network';
import Commands from './pages/Commands';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import CreateNodeModal from './components/CreateNodeModal';

function App() {
  const [showCreateNode, setShowCreateNode] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/nodes', label: 'Nodes' },
    { to: '/network', label: 'Network' },
    { to: '/commands', label: 'Commands' },
    { to: '/logs', label: 'Logs' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <BrowserRouter>
      <div className="drawer lg:drawer-open">
        <input id="drawer" type="checkbox" className="drawer-toggle" />

        {/* Main content area */}
        <div className="drawer-content flex flex-col min-h-screen">
          {/* Header */}
          <header className="navbar bg-base-100 border-b border-base-300 sticky top-0 z-30">
            <div className="flex-none lg:hidden">
              <label htmlFor="drawer" className="btn btn-square btn-ghost">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-5 h-5 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </label>
            </div>
            <div className="flex-1 lg:hidden">
              <span className="text-lg font-semibold">LoRa Manager</span>
            </div>
            <div className="flex-1 hidden lg:block" />
            <div className="flex-none gap-2">
              {/* Theme toggle */}
              <label className="swap swap-rotate btn btn-ghost btn-circle">
                <input
                  type="checkbox"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                />
                {/* Sun icon */}
                <svg
                  className="swap-off fill-current w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                >
                  <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
                </svg>
                {/* Moon icon */}
                <svg
                  className="swap-on fill-current w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                >
                  <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
                </svg>
              </label>

              {/* Create node button */}
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateNode(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                <span className="hidden sm:inline">Create Node</span>
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6 bg-base-200">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/nodes" element={<Nodes />} />
              <Route path="/nodes/:name" element={<NodeDetail />} />
              <Route path="/network" element={<Network />} />
              <Route path="/commands" element={<Commands />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>

        {/* Sidebar */}
        <div className="drawer-side z-40">
          <label htmlFor="drawer" aria-label="close sidebar" className="drawer-overlay" />
          <aside className="bg-base-100 w-64 min-h-screen border-r border-base-300">
            <div className="p-4 border-b border-base-300">
              <h1 className="text-xl font-bold">LoRa Manager</h1>
            </div>
            <ul className="menu p-2 gap-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? 'active font-medium' : ''
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>

      {showCreateNode && (
        <CreateNodeModal onClose={() => setShowCreateNode(false)} />
      )}
    </BrowserRouter>
  );
}

export default App;
