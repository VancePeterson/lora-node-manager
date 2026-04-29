import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchNodes, fetchGateway } from '../api/client';
import { getNodeDisplayName } from '../types';

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
        <div className="stat">
          <div className="stat-title">Gateway</div>
          <div className={`stat-value text-2xl ${gateway?.online ? 'text-success' : 'text-error'}`}>
            {gateway?.online ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Nodes Online</div>
          <div className="stat-value text-2xl text-success">{onlineNodes.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Nodes Offline</div>
          <div className="stat-value text-2xl text-error">{offlineNodes.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Weak Signal</div>
          <div className={`stat-value text-2xl ${weakSignalNodes.length > 0 ? 'text-warning' : ''}`}>
            {weakSignalNodes.length}
          </div>
        </div>
      </div>

      {/* Gateway and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Gateway Status</h2>
            {gateway ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Status:</span>{' '}
                  <span className={gateway.online ? 'text-success' : 'text-error'}>
                    {gateway.online ? 'Online' : 'Offline'}
                  </span>
                </p>
                {gateway.firmware_version && (
                  <p>
                    <span className="font-medium">Firmware:</span> {gateway.firmware_version}
                  </p>
                )}
                {gateway.uptime_seconds !== null && (
                  <p>
                    <span className="font-medium">Uptime:</span> {formatUptime(gateway.uptime_seconds)}
                  </p>
                )}
                <p>
                  <span className="font-medium">Messages:</span> {gateway.message_count}
                </p>
              </div>
            ) : (
              <p className="text-base-content/60">Loading gateway status...</p>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Alerts</h2>
            {offlineNodes.length === 0 && weakSignalNodes.length === 0 ? (
              <div className="text-center py-4 text-base-content/60">
                <p>No alerts</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {offlineNodes.map((node) => (
                  <li key={node.address} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-error mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <Link
                          to={`/nodes/${node.address}`}
                          className="link link-primary"
                        >
                          {getNodeDisplayName(node)}
                        </Link>{' '}
                        is offline
                      </div>
                      {node.last_seen && (
                        <div className="text-xs text-base-content/60">
                          Last seen {formatTimeAgo(node.last_seen)}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
                {weakSignalNodes.map((node) => (
                  <li key={`weak-${node.address}`} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-warning mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <Link
                          to={`/nodes/${node.address}`}
                          className="link link-primary"
                        >
                          {getNodeDisplayName(node)}
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
      </div>

      {/* Recent Nodes */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Recent Nodes</h2>
          {nodes && nodes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>RSSI</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.slice(0, 5).map((node) => (
                    <tr key={node.address}>
                      <td>
                        <Link
                          to={`/nodes/${node.address}`}
                          className="link link-primary"
                        >
                          {getNodeDisplayName(node)}
                        </Link>
                      </td>
                      <td className="font-mono text-sm">{node.address}</td>
                      <td>
                        <span className={`badge badge-sm ${node.online ? 'badge-success' : 'badge-error'}`}>
                          {node.online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td>{node.rssi !== null ? `${node.rssi} dBm` : '-'}</td>
                      <td>{node.last_seen ? formatTimeAgo(node.last_seen) : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/60">
              <p>No nodes discovered yet</p>
            </div>
          )}
          {nodes && nodes.length > 5 && (
            <div className="mt-4">
              <Link to="/nodes" className="link link-primary text-sm">
                View all {nodes.length} nodes
              </Link>
            </div>
          )}
        </div>
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
