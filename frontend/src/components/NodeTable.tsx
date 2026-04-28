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

export default function NodeTable({ nodes }: NodeTableProps) {
  if (nodes.length === 0) {
    return (
      <div className="empty-state">
        <p>No nodes discovered yet</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
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
              <Link to={`/nodes/${encodeURIComponent(node.name)}`}>
                {node.name}
              </Link>
            </td>
            <td>{node.node_type}</td>
            <td>
              <span className={`status-badge ${node.online ? 'online' : 'offline'}`}>
                {node.online ? 'Online' : 'Offline'}
              </span>
            </td>
            <td>{node.rssi !== null ? `${node.rssi} dBm` : '-'}</td>
            <td>{node.snr !== null ? `${node.snr.toFixed(1)} dB` : '-'}</td>
            <td>{formatLastSeen(node.last_seen)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
