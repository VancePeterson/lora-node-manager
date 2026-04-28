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

    // Add to history (actual sending will be implemented with backend)
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
    // For now, simulate success after a delay
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

  return (
    <div>
      <div className="page-header">
        <h1>Commands</h1>
      </div>

      <div className="card">
        <h2>Send Command</h2>
        <form onSubmit={handleSendCommand}>
          <div className="form-group">
            <label htmlFor="target-node">Target Node</label>
            <select
              id="target-node"
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

          <div className="form-group">
            <label htmlFor="command">Command</label>
            <input
              type="text"
              id="command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter command..."
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {presetCommands.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className="btn btn-secondary"
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

      <div className="card">
        <h2>Command History</h2>
        {commandHistory.length === 0 ? (
          <div className="empty-state">
            <p>No commands sent yet</p>
          </div>
        ) : (
          <table>
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
                    <code>{entry.command}</code>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        entry.status === 'sent'
                          ? 'online'
                          : entry.status === 'failed'
                          ? 'offline'
                          : ''
                      }`}
                      style={
                        entry.status === 'pending'
                          ? { background: '#fef3c7', color: '#92400e' }
                          : undefined
                      }
                    >
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
        )}
      </div>
    </div>
  );
}
