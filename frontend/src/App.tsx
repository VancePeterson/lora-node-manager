import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
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

  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-header">
            <h1>LoRa Manager</h1>
          </div>
          <ul className="sidebar-nav">
            <li>
              <NavLink to="/" end>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/nodes">Nodes</NavLink>
            </li>
            <li>
              <NavLink to="/network">Network</NavLink>
            </li>
            <li>
              <NavLink to="/commands">Commands</NavLink>
            </li>
            <li>
              <NavLink to="/logs">Logs</NavLink>
            </li>
            <li>
              <NavLink to="/settings">Settings</NavLink>
            </li>
          </ul>
        </nav>
        <main className="main-content">
          <header className="top-header">
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateNode(true)}
            >
              + Create Node
            </button>
          </header>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/nodes" element={<Nodes />} />
              <Route path="/nodes/:name" element={<NodeDetail />} />
              <Route path="/network" element={<Network />} />
              <Route path="/commands" element={<Commands />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>

      {showCreateNode && (
        <CreateNodeModal onClose={() => setShowCreateNode(false)} />
      )}
    </BrowserRouter>
  );
}

export default App;
