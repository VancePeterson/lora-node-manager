import { Link } from 'react-router-dom';
import type { NodeState } from '../types';

interface NodeTableProps {
  nodes: NodeState[];
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Never';
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getSignalBadge(rssi: number): string {
  if (rssi >= -70) return 'badge badge-success';
  if (rssi >= -80) return 'badge badge-info';
  if (rssi >= -90) return 'badge badge-warning';
  return 'badge badge-error';
}

export default function NodeTable({ nodes }: NodeTableProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/60">
        <p>No nodes discovered yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>RSSI</th>
            <th>SNR</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.name}>
              <td>
                <Link
                  to={`/nodes/${encodeURIComponent(node.name)}`}
                  className="link link-primary"
                >
                  {node.name}
                </Link>
              </td>
              <td>
                <span className={`badge badge-sm ${node.online ? 'badge-success' : 'badge-error'}`}>
                  {node.online ? 'Online' : 'Offline'}
                </span>
              </td>
              <td>
                {node.rssi !== null ? (
                  <span className={`badge badge-sm ${getSignalBadge(node.rssi).replace('badge ', '')}`}>
                    {node.rssi} dBm
                  </span>
                ) : (
                  '-'
                )}
              </td>
              <td>{node.snr !== null ? `${node.snr.toFixed(1)} dB` : '-'}</td>
              <td>{formatLastSeen(node.last_seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
