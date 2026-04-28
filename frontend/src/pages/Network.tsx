import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchNodes } from '../api/client';

export default function Network() {
  const { data: nodes, isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h1>Network</h1>
        </div>
        <div className="card">Loading network data...</div>
      </div>
    );
  }

  const nodesWithSignal = (nodes ?? [])
    .filter((n) => n.rssi !== null)
    .sort((a, b) => (b.rssi ?? 0) - (a.rssi ?? 0));

  const getSignalQuality = (rssi: number): { label: string; color: string } => {
    if (rssi >= -70) return { label: 'Excellent', color: '#16a34a' };
    if (rssi >= -80) return { label: 'Good', color: '#65a30d' };
    if (rssi >= -90) return { label: 'Fair', color: '#d97706' };
    return { label: 'Weak', color: '#dc2626' };
  };

  const getSignalBarWidth = (rssi: number): number => {
    // Map RSSI from -120 (0%) to -40 (100%)
    const percent = Math.max(0, Math.min(100, ((rssi + 120) / 80) * 100));
    return percent;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Network</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Nodes with Signal</div>
          <div className="value">{nodesWithSignal.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg RSSI</div>
          <div className="value">
            {nodesWithSignal.length > 0
              ? `${Math.round(
                  nodesWithSignal.reduce((sum, n) => sum + (n.rssi ?? 0), 0) /
                    nodesWithSignal.length
                )} dBm`
              : '-'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Avg SNR</div>
          <div className="value">
            {nodesWithSignal.filter((n) => n.snr !== null).length > 0
              ? `${(
                  nodesWithSignal
                    .filter((n) => n.snr !== null)
                    .reduce((sum, n) => sum + (n.snr ?? 0), 0) /
                  nodesWithSignal.filter((n) => n.snr !== null).length
                ).toFixed(1)} dB`
              : '-'}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Signal Strength by Node</h2>
        {nodesWithSignal.length === 0 ? (
          <div className="empty-state">
            <p>No signal data available yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {nodesWithSignal.map((node) => {
              const quality = getSignalQuality(node.rssi!);
              const barWidth = getSignalBarWidth(node.rssi!);

              return (
                <div key={node.name}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <Link to={`/nodes/${encodeURIComponent(node.name)}`}>
                      {node.name}
                    </Link>
                    <span style={{ color: quality.color, fontWeight: 500 }}>
                      {node.rssi} dBm ({quality.label})
                    </span>
                  </div>
                  <div
                    style={{
                      background: '#e5e7eb',
                      borderRadius: '4px',
                      height: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        background: quality.color,
                        width: `${barWidth}%`,
                        height: '100%',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Signal Details</h2>
        {nodesWithSignal.length === 0 ? (
          <div className="empty-state">
            <p>No signal data available</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>RSSI</th>
                <th>SNR</th>
                <th>Quality</th>
                <th>Packets</th>
                <th>Gaps</th>
              </tr>
            </thead>
            <tbody>
              {nodesWithSignal.map((node) => {
                const quality = getSignalQuality(node.rssi!);
                return (
                  <tr key={node.name}>
                    <td>
                      <Link to={`/nodes/${encodeURIComponent(node.name)}`}>
                        {node.name}
                      </Link>
                    </td>
                    <td>{node.rssi} dBm</td>
                    <td>{node.snr !== null ? `${node.snr.toFixed(1)} dB` : '-'}</td>
                    <td style={{ color: quality.color }}>{quality.label}</td>
                    <td>{node.packets_rx}</td>
                    <td>{node.gap_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
