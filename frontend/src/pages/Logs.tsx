import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLogs, fetchNodes } from '../api/client';

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

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', nodeFilter, levelFilter, categoryFilter],
    queryFn: () =>
      fetchLogs({
        node_name: nodeFilter || undefined,
        level: levelFilter || undefined,
        category: categoryFilter || undefined,
        limit: 200,
      }),
    refetchInterval: 5000,
  });

  const getLevelBadgeStyle = (level: string) => {
    switch (level) {
      case 'error':
        return { background: '#fee2e2', color: '#991b1b' };
      case 'warning':
        return { background: '#fef3c7', color: '#92400e' };
      default:
        return { background: '#e0e7ff', color: '#3730a3' };
    }
  };

  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case 'mqtt':
        return { background: '#dbeafe', color: '#1e40af' };
      case 'node':
        return { background: '#dcfce7', color: '#166534' };
      case 'command':
        return { background: '#fae8ff', color: '#86198f' };
      default:
        return { background: '#f3f4f6', color: '#374151' };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const clearFilters = () => {
    setNodeFilter('');
    setLevelFilter('');
    setCategoryFilter('');
  };

  const hasFilters = nodeFilter || levelFilter || categoryFilter;

  return (
    <div>
      <div className="page-header">
        <h1>Logs</h1>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-node">Node</label>
            <select
              id="filter-node"
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
            >
              <option value="">All nodes</option>
              {nodes?.map((node) => (
                <option key={node.name} value={node.name}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-level">Level</label>
            <select
              id="filter-level"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LogLevel)}
            >
              <option value="">All levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-category">Category</label>
            <select
              id="filter-category"
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
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <p>Loading logs...</p>
        ) : logs && logs.length > 0 ? (
          <div className="log-list">
            {logs.map((log) => (
              <div key={log.id} className="log-entry">
                <div className="log-header">
                  <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                  <span
                    className="log-badge"
                    style={getLevelBadgeStyle(log.level)}
                  >
                    {log.level}
                  </span>
                  <span
                    className="log-badge"
                    style={getCategoryBadgeStyle(log.category)}
                  >
                    {log.category}
                  </span>
                  {log.node_name && (
                    <span className="log-node">{log.node_name}</span>
                  )}
                </div>
                <div className="log-message">{log.message}</div>
                {log.details && (
                  <details className="log-details">
                    <summary>Details</summary>
                    <pre>{JSON.stringify(log.details, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
