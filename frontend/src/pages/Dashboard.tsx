import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchNodes, fetchGateway } from '../api/client';

export default function Dashboard() {
  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    refetchInterval: 5000,
  });

  const { data: gateway } = useQuery({
    queryKey: ['gateway'],
    queryFn: fetchGateway,
    refetchInterval: 5000,
  });

  const onlineNodes = nodes?.filter((n) => n.online) ?? [];
  const offlineNodes = nodes?.filter((n) => !n.online) ?? [];
  const weakSignalNodes = nodes?.filter((n) => n.rssi !== null && n.rssi < -90) ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Gateway</div>
          <div className={`value ${gateway?.online ? 'online' : 'offline'}`}>
            {gateway?.online ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Nodes Online</div>
          <div className="value online">{onlineNodes.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Nodes Offline</div>
          <div className="value offline">{offlineNodes.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Weak Signal</div>
          <div className={`value ${weakSignalNodes.length > 0 ? 'warning' : ''}`}>
            {weakSignalNodes.length}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Gateway Status</h2>
          {gateway ? (
            <div>
              <p>
                <strong>Status:</strong>{' '}
                <span className={gateway.online ? 'status-online' : 'status-offline'}>
                  {gateway.online ? 'Online' : 'Offline'}
                </span>
              </p>
              {gateway.firmware_version && (
                <p>
                  <strong>Firmware:</strong> {gateway.firmware_version}
                </p>
              )}
              {gateway.uptime_seconds !== null && (
                <p>
                  <strong>Uptime:</strong> {formatUptime(gateway.uptime_seconds)}
                </p>
              )}
              <p>
                <strong>Messages:</strong> {gateway.message_count}
              </p>
            </div>
          ) : (
            <p className="empty-state">Loading gateway status...</p>
          )}
        </div>

        <div className="card">
          <h2>Alerts</h2>
          {offlineNodes.length === 0 && weakSignalNodes.length === 0 ? (
            <div className="empty-state">
              <p>No alerts</p>
            </div>
          ) : (
            <ul className="activity-list">
              {offlineNodes.map((node) => (
                <li key={node.name} className="activity-item">
                  <span className="activity-dot offline" />
                  <div className="activity-content">
                    <div className="activity-text">
                      <Link to={`/nodes/${encodeURIComponent(node.name)}`}>
                        {node.name}
                      </Link>{' '}
                      is offline
                    </div>
                    {node.last_seen && (
                      <div className="activity-time">
                        Last seen {formatTimeAgo(node.last_seen)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {weakSignalNodes.map((node) => (
                <li key={`weak-${node.name}`} className="activity-item">
                  <span className="activity-dot state" />
                  <div className="activity-content">
                    <div className="activity-text">
                      <Link to={`/nodes/${encodeURIComponent(node.name)}`}>
                        {node.name}
                      </Link>{' '}
                      has weak signal ({node.rssi} dBm)
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Recent Nodes</h2>
        {nodes && nodes.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>RSSI</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {nodes.slice(0, 5).map((node) => (
                <tr key={node.name}>
                  <td>
                    <Link to={`/nodes/${encodeURIComponent(node.name)}`}>
                      {node.name}
                    </Link>
                  </td>
                  <td>
                    <span className={`status-badge ${node.online ? 'online' : 'offline'}`}>
                      {node.online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td>{node.rssi !== null ? `${node.rssi} dBm` : '-'}</td>
                  <td>{node.last_seen ? formatTimeAgo(node.last_seen) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>No nodes discovered yet</p>
          </div>
        )}
        {nodes && nodes.length > 5 && (
          <p style={{ marginTop: '1rem' }}>
            <Link to="/nodes">View all {nodes.length} nodes</Link>
          </p>
        )}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString();
}
