import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNodes } from '../api/client';
import NodeTable from '../components/NodeTable';
import type { NodeState } from '../types';

type SortKey = 'name' | 'status' | 'rssi' | 'last_seen';
type FilterStatus = 'all' | 'online' | 'offline';

export default function Nodes() {
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const { data: nodes, isLoading, error } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h1>Nodes</h1>
        </div>
        <div className="card">Loading nodes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1>Nodes</h1>
        </div>
        <div className="card">
          <p>Error loading nodes: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const filteredNodes = (nodes ?? []).filter((node) => {
    if (filterStatus === 'online') return node.online;
    if (filterStatus === 'offline') return !node.online;
    return true;
  });

  const sortedNodes = [...filteredNodes].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status':
        return (b.online ? 1 : 0) - (a.online ? 1 : 0);
      case 'rssi':
        return (b.rssi ?? -999) - (a.rssi ?? -999);
      case 'last_seen':
        return (
          new Date(b.last_seen ?? 0).getTime() -
          new Date(a.last_seen ?? 0).getTime()
        );
      default:
        return 0;
    }
  });

  const onlineCount = (nodes ?? []).filter((n) => n.online).length;
  const offlineCount = (nodes ?? []).filter((n) => !n.online).length;

  return (
    <div>
      <div className="page-header">
        <h1>Nodes</h1>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            >
              <option value="all">All ({nodes?.length ?? 0})</option>
              <option value="online">Online ({onlineCount})</option>
              <option value="offline">Offline ({offlineCount})</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="sort-by">Sort by</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="rssi">Signal Strength</option>
              <option value="last_seen">Last Seen</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <NodeTable nodes={sortedNodes} />
      </div>
    </div>
  );
}
