import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchNode, fetchNodeHistory } from '../api/client';
import { getNodeDisplayName } from '../types';

function getSignalBadge(rssi: number): { className: string; label: string } {
  if (rssi >= -70) return { className: 'badge badge-success', label: 'Excellent' };
  if (rssi >= -80) return { className: 'badge badge-info', label: 'Good' };
  if (rssi >= -90) return { className: 'badge badge-warning', label: 'Fair' };
  return { className: 'badge badge-error', label: 'Weak' };
}

export default function NodeDetail() {
  const { address } = useParams<{ address: string }>();
  const addressNum = parseInt(address ?? '', 10);

  const { data: node, isLoading: nodeLoading, error: nodeError } = useQuery({
    queryKey: ['node', addressNum],
    queryFn: () => fetchNode(addressNum),
    enabled: !isNaN(addressNum),
    refetchInterval: 5000,
  });

  const { data: history } = useQuery({
    queryKey: ['nodeHistory', addressNum],
    queryFn: () => fetchNodeHistory(addressNum, 24),
    enabled: !isNaN(addressNum),
    refetchInterval: 30000,
  });

  if (isNaN(addressNum)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Node Details</h1>
        <div className="alert alert-error">
          <span>Invalid node address</span>
        </div>
        <Link to="/nodes" className="btn btn-ghost">
          Back to nodes
        </Link>
      </div>
    );
  }

  if (nodeLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Node Details</h1>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body flex flex-row items-center gap-3">
            <span className="loading loading-spinner loading-md"></span>
            <span>Loading node details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (nodeError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Node Details</h1>
        <div className="alert alert-error">
          <span>Error: {(nodeError as Error).message}</span>
        </div>
        <Link to="/nodes" className="btn btn-ghost">
          Back to nodes
        </Link>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Node Details</h1>
        <div className="alert alert-warning">
          <span>Node not found</span>
        </div>
        <Link to="/nodes" className="btn btn-ghost">
          Back to nodes
        </Link>
      </div>
    );
  }

  const signalInfo = node.rssi !== null ? getSignalBadge(node.rssi) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/nodes" className="btn btn-ghost btn-sm gap-1 mb-2 -ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to nodes
        </Link>
        <h1 className="text-2xl font-bold">{getNodeDisplayName(node)}</h1>
        <p className="text-base-content/60 text-sm">Address: {node.address}</p>
      </div>

      {/* Stats */}
      <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
        <div className="stat">
          <div className="stat-title">Status</div>
          <div className={`stat-value text-xl ${node.online ? 'text-success' : 'text-error'}`}>
            {node.online ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">RSSI</div>
          <div className="stat-value text-xl">
            {node.rssi !== null ? (
              <span className={signalInfo?.className}>{node.rssi} dBm</span>
            ) : (
              '-'
            )}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">SNR</div>
          <div className="stat-value text-xl">
            {node.snr !== null ? `${node.snr.toFixed(1)} dB` : '-'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Packets</div>
          <div className="stat-value text-xl">{node.packets_rx}</div>
        </div>
      </div>

      {/* Details and Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Details</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <td className="font-medium w-36">Address</td>
                    <td className="font-mono">{node.address}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Display Name</td>
                    <td>{node.name || <span className="text-base-content/60">Not set</span>}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Signal Quality</td>
                    <td>
                      {signalInfo ? (
                        <span className={signalInfo.className}>{signalInfo.label}</span>
                      ) : (
                        'Unknown'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">Gap Count</td>
                    <td>{node.gap_count}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Last Seen</td>
                    <td>
                      {node.last_seen
                        ? new Date(node.last_seen).toLocaleString()
                        : 'Never'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Telemetry</h2>
            {Object.keys(node.telemetry).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <tbody>
                    {Object.entries(node.telemetry).map(([key, value]) => (
                      <tr key={key}>
                        <td className="font-medium w-36">{key}</td>
                        <td>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-base-content/60">
                <p>No telemetry data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RSSI History */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">RSSI History (24h)</h2>
          {history && history.length > 0 ? (
            <>
              <p className="text-sm text-base-content/60 mb-2">
                {history.length} data points recorded
              </p>
              <div className="overflow-x-auto">
                <table className="table table-sm table-zebra">
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
              </div>
              {history.length > 10 && (
                <p className="text-sm text-base-content/60 mt-2">
                  Showing 10 of {history.length} entries
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-base-content/60">
              <p>No history data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
