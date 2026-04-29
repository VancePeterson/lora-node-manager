import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLogs, fetchNodes } from '../api/client';
import { getNodeDisplayName } from '../types';

type LogLevel = '' | 'info' | 'warning' | 'error';
type LogCategory = '' | 'system' | 'mqtt' | 'node' | 'command';

export default function Logs() {
  const [nodeFilter, setNodeFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<LogLevel>('');
  const [categoryFilter, setCategoryFilter] = useState<LogCategory>('');

  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
  });

  const nodeAddress = nodeFilter ? parseInt(nodeFilter, 10) : undefined;

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', nodeAddress, levelFilter, categoryFilter],
    queryFn: () =>
      fetchLogs({
        node_address: nodeAddress,
        level: levelFilter || undefined,
        category: categoryFilter || undefined,
        limit: 200,
      }),
    refetchInterval: 5000,
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return 'badge badge-error';
      case 'warning':
        return 'badge badge-warning';
      default:
        return 'badge badge-info';
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'mqtt':
        return 'badge badge-primary badge-outline';
      case 'node':
        return 'badge badge-success badge-outline';
      case 'command':
        return 'badge badge-secondary badge-outline';
      default:
        return 'badge badge-ghost';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getNodeName = (address: number | null) => {
    if (address === null) return null;
    const node = nodes?.find((n) => n.address === address);
    return node ? getNodeDisplayName(node) : `Node ${address}`;
  };

  const clearFilters = () => {
    setNodeFilter('');
    setLevelFilter('');
    setCategoryFilter('');
  };

  const hasFilters = nodeFilter || levelFilter || categoryFilter;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Logs</h1>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="form-control w-full sm:w-auto">
              <label className="label py-1">
                <span className="label-text">Node</span>
              </label>
              <select
                className="select select-bordered select-sm w-full sm:w-48"
                value={nodeFilter}
                onChange={(e) => setNodeFilter(e.target.value)}
              >
                <option value="">All nodes</option>
                {nodes?.map((node) => (
                  <option key={node.address} value={node.address.toString()}>
                    {getNodeDisplayName(node)} ({node.address})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control w-full sm:w-auto">
              <label className="label py-1">
                <span className="label-text">Level</span>
              </label>
              <select
                className="select select-bordered select-sm w-full sm:w-32"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as LogLevel)}
              >
                <option value="">All levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div className="form-control w-full sm:w-auto">
              <label className="label py-1">
                <span className="label-text">Category</span>
              </label>
              <select
                className="select select-bordered select-sm w-full sm:w-36"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as LogCategory)}
              >
                <option value="">All categories</option>
                <option value="system">System</option>
                <option value="mqtt">MQTT</option>
                <option value="node">Node</option>
                <option value="command">Command</option>
              </select>
            </div>

            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <span className="loading loading-spinner loading-md"></span>
              <span>Loading logs...</span>
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 border border-base-300 rounded-lg bg-base-50"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xs text-base-content/60 font-mono">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className={`${getLevelBadge(log.level)} badge-xs uppercase`}>
                      {log.level}
                    </span>
                    <span className={`${getCategoryBadge(log.category)} badge-xs`}>
                      {log.category}
                    </span>
                    {log.node_address !== null && (
                      <span className="badge badge-ghost badge-xs">
                        {getNodeName(log.node_address)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm">{log.message}</div>
                  {log.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-base-content/60 cursor-pointer hover:text-base-content">
                        Details
                      </summary>
                      <pre className="mt-2 p-2 bg-base-200 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/60">
              <p>No logs found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
