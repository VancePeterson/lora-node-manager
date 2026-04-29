import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNodes } from '../api/client';

interface CommandHistoryEntry {
  id: number;
  timestamp: Date;
  target: string;
  command: string;
  status: 'sent' | 'pending' | 'failed';
}

export default function Commands() {
  const [targetNode, setTargetNode] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);

  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    refetchInterval: 5000,
  });

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetNode || !command.trim()) return;

    const entry: CommandHistoryEntry = {
      id: Date.now(),
      timestamp: new Date(),
      target: targetNode,
      command: command.trim(),
      status: 'pending',
    };

    setCommandHistory((prev) => [entry, ...prev]);
    setCommand('');

    // TODO: Actually send command via API
    setTimeout(() => {
      setCommandHistory((prev) =>
        prev.map((h) => (h.id === entry.id ? { ...h, status: 'sent' as const } : h))
      );
    }, 500);
  };

  const presetCommands = [
    { label: 'Ping', value: 'PING' },
    { label: 'Status', value: 'STATUS' },
    { label: 'Reboot', value: 'REBOOT' },
    { label: 'Config', value: 'CONFIG?' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return 'badge badge-success';
      case 'failed':
        return 'badge badge-error';
      default:
        return 'badge badge-warning';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Commands</h1>

      {/* Send Command Form */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Send Command</h2>
          <form onSubmit={handleSendCommand} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Target Node</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={targetNode}
                onChange={(e) => setTargetNode(e.target.value)}
              >
                <option value="">Select a node...</option>
                <option value="broadcast">Broadcast (all nodes)</option>
                {nodes?.map((node) => (
                  <option key={node.name} value={node.name}>
                    {node.name} {node.online ? '(online)' : '(offline)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Command</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command..."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {presetCommands.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setCommand(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!targetNode || !command.trim()}
            >
              Send Command
            </button>
          </form>
        </div>
      </div>

      {/* Command History */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Command History</h2>
          {commandHistory.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <p>No commands sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Target</th>
                    <th>Command</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commandHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.timestamp.toLocaleTimeString()}</td>
                      <td>{entry.target}</td>
                      <td>
                        <code className="bg-base-200 px-2 py-0.5 rounded text-sm">
                          {entry.command}
                        </code>
                      </td>
                      <td>
                        <span className={`${getStatusBadge(entry.status)} badge-sm`}>
                          {entry.status === 'sent'
                            ? 'Sent'
                            : entry.status === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
