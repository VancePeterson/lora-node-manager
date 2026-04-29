import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNodes } from '../api/client';
import NodeTable from '../components/NodeTable';

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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Nodes</h1>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <span className="loading loading-spinner loading-md"></span>
            <p>Loading nodes...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Nodes</h1>
        <div className="alert alert-error">
          <span>Error loading nodes: {(error as Error).message}</span>
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nodes</h1>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="form-control w-full sm:w-auto">
              <label className="label py-1">
                <span className="label-text">Status</span>
              </label>
              <select
                className="select select-bordered select-sm w-full sm:w-40"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              >
                <option value="all">All ({nodes?.length ?? 0})</option>
                <option value="online">Online ({onlineCount})</option>
                <option value="offline">Offline ({offlineCount})</option>
              </select>
            </div>
            <div className="form-control w-full sm:w-auto">
              <label className="label py-1">
                <span className="label-text">Sort by</span>
              </label>
              <select
                className="select select-bordered select-sm w-full sm:w-40"
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
      </div>

      {/* Node Table */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <NodeTable nodes={sortedNodes} />
        </div>
      </div>
    </div>
  );
}
