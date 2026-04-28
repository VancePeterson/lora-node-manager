import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchNode, fetchNodeHistory } from '../api/client';

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>();

  const { data: node, isLoading: nodeLoading, error: nodeError } = useQuery({
    queryKey: ['node', name],
    queryFn: () => fetchNode(name!),
    enabled: !!name,
    refetchInterval: 5000,
  });

  const { data: history } = useQuery({
    queryKey: ['nodeHistory', name],
    queryFn: () => fetchNodeHistory(name!, 24),
    enabled: !!name,
    refetchInterval: 30000,
  });

  if (nodeLoading) {
    return (
      <div>
        <div className="page-header">
          <h1>Node Details</h1>
        </div>
        <div className="card">Loading node details...</div>
      </div>
    );
  }

  if (nodeError) {
    return (
      <div>
        <div className="page-header">
          <h1>Node Details</h1>
        </div>
        <div className="card">
          <p>Error: {(nodeError as Error).message}</p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/nodes">Back to nodes</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div>
        <div className="page-header">
          <h1>Node Details</h1>
        </div>
        <div className="card">
          <p>Node not found</p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/nodes">Back to nodes</Link>
          </p>
        </div>
      </div>
    );
  }

  const getSignalQuality = (rssi: number): { label: string; color: string } => {
    if (rssi >= -70) return { label: 'Excellent', color: '#16a34a' };
    if (rssi >= -80) return { label: 'Good', color: '#65a30d' };
    if (rssi >= -90) return { label: 'Fair', color: '#d97706' };
    return { label: 'Weak', color: '#dc2626' };
  };

  const signalQuality = node.rssi !== null ? getSignalQuality(node.rssi) : null;

  return (
    <div>
      <div className="page-header">
        <p style={{ marginBottom: '0.5rem' }}>
          <Link to="/nodes">← Back to nodes</Link>
        </p>
        <h1>{node.name}</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Status</div>
          <div className={`value ${node.online ? 'online' : 'offline'}`}>
            {node.online ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">RSSI</div>
          <div className="value" style={{ color: signalQuality?.color }}>
            {node.rssi !== null ? `${node.rssi} dBm` : '-'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">SNR</div>
          <div className="value">
            {node.snr !== null ? `${node.snr.toFixed(1)} dB` : '-'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Packets</div>
          <div className="value">{node.packets_rx}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Details</h2>
          <table>
            <tbody>
              <tr>
                <td style={{ fontWeight: 500, width: '140px' }}>Type</td>
                <td>{node.node_type}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Address</td>
                <td>{node.address}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Signal Quality</td>
                <td style={{ color: signalQuality?.color }}>
                  {signalQuality?.label ?? 'Unknown'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Gap Count</td>
                <td>{node.gap_count}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Last Seen</td>
                <td>
                  {node.last_seen
                    ? new Date(node.last_seen).toLocaleString()
                    : 'Never'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Telemetry</h2>
          {Object.keys(node.telemetry).length > 0 ? (
            <table>
              <tbody>
                {Object.entries(node.telemetry).map(([key, value]) => (
                  <tr key={key}>
                    <td style={{ fontWeight: 500, width: '140px' }}>{key}</td>
                    <td>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No telemetry data</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>RSSI History (24h)</h2>
        {history && history.length > 0 ? (
          <div>
            <p style={{ marginBottom: '1rem' }}>{history.length} data points recorded</p>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>RSSI</th>
                  <th>SNR</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((entry, idx) => (
                  <tr key={idx}>
                    <td>{new Date(entry.timestamp).toLocaleString()}</td>
                    <td>{entry.rssi} dBm</td>
                    <td>{entry.snr.toFixed(1)} dB</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length > 10 && (
              <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                Showing 10 of {history.length} entries
              </p>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>No history data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
