import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchNodes } from '../api/client';
import { getNodeDisplayName } from '../types';

function getSignalBadge(rssi: number): { className: string; label: string; color: string } {
  if (rssi >= -70) return { className: 'badge badge-success', label: 'Excellent', color: '#16a34a' };
  if (rssi >= -80) return { className: 'badge badge-info', label: 'Good', color: '#0ea5e9' };
  if (rssi >= -90) return { className: 'badge badge-warning', label: 'Fair', color: '#eab308' };
  return { className: 'badge badge-error', label: 'Weak', color: '#ef4444' };
}

function getSignalBarWidth(rssi: number): number {
  // Map RSSI from -120 (0%) to -40 (100%)
  const percent = Math.max(0, Math.min(100, ((rssi + 120) / 80) * 100));
  return percent;
}

export default function Network() {
  const { data: nodes, isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Network</h1>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body flex flex-row items-center gap-3">
            <span className="loading loading-spinner loading-md"></span>
            <span>Loading network data...</span>
          </div>
        </div>
      </div>
    );
  }

  const nodesWithSignal = (nodes ?? [])
    .filter((n) => n.rssi !== null)
    .sort((a, b) => (b.rssi ?? 0) - (a.rssi ?? 0));

  const avgRssi =
    nodesWithSignal.length > 0
      ? Math.round(
          nodesWithSignal.reduce((sum, n) => sum + (n.rssi ?? 0), 0) /
            nodesWithSignal.length
        )
      : null;

  const nodesWithSnr = nodesWithSignal.filter((n) => n.snr !== null);
  const avgSnr =
    nodesWithSnr.length > 0
      ? (
          nodesWithSnr.reduce((sum, n) => sum + (n.snr ?? 0), 0) /
          nodesWithSnr.length
        ).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Network</h1>

      {/* Stats */}
      <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
        <div className="stat">
          <div className="stat-title">Nodes with Signal</div>
          <div className="stat-value text-2xl">{nodesWithSignal.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Avg RSSI</div>
          <div className="stat-value text-2xl">
            {avgRssi !== null ? `${avgRssi} dBm` : '-'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Avg SNR</div>
          <div className="stat-value text-2xl">
            {avgSnr !== null ? `${avgSnr} dB` : '-'}
          </div>
        </div>
      </div>

      {/* Signal Strength Bars */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Signal Strength by Node</h2>
          {nodesWithSignal.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <p>No signal data available yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {nodesWithSignal.map((node) => {
                const signalInfo = getSignalBadge(node.rssi!);
                const barWidth = getSignalBarWidth(node.rssi!);

                return (
                  <div key={node.address}>
                    <div className="flex justify-between mb-1">
                      <Link
                        to={`/nodes/${node.address}`}
                        className="link link-primary text-sm"
                      >
                        {getNodeDisplayName(node)}
                      </Link>
                      <span className={`${signalInfo.className} badge-sm`}>
                        {node.rssi} dBm ({signalInfo.label})
                      </span>
                    </div>
                    <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: signalInfo.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Signal Details Table */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Signal Details</h2>
          {nodesWithSignal.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <p>No signal data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Address</th>
                    <th>RSSI</th>
                    <th>SNR</th>
                    <th>Quality</th>
                    <th>Packets</th>
                    <th>Gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {nodesWithSignal.map((node) => {
                    const signalInfo = getSignalBadge(node.rssi!);
                    return (
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
                        <td>{node.rssi} dBm</td>
                        <td>{node.snr !== null ? `${node.snr.toFixed(1)} dB` : '-'}</td>
                        <td>
                          <span className={`${signalInfo.className} badge-sm`}>
                            {signalInfo.label}
                          </span>
                        </td>
                        <td>{node.packets_rx}</td>
                        <td>{node.gap_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
