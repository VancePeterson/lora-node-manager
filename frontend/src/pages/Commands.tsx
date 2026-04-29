import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchNodes, sendCommand } from '../api/client';
import { getNodeDisplayName } from '../types';

interface CommandHistoryEntry {
  id: number;
  timestamp: Date;
  target: string;  // Display name or "Broadcast"
  targetAddress: number | null;  // null for broadcast
  command: string;
  status: 'sent' | 'pending' | 'failed';
  error?: string;
}

export default function Commands() {
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);

  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async ({ address, cmd }: { address: number | 'broadcast'; cmd: string }) => {
      // If broadcast, send to all online nodes
      if (address === 'broadcast') {
        const onlineNodes = nodes?.filter((n) => n.online) ?? [];
        const results = await Promise.allSettled(
          onlineNodes.map((node) => sendCommand(node.address, cmd))
        );
        return { broadcast: true, results, nodeCount: onlineNodes.length };
      }
      return sendCommand(address, cmd);
    },
  });

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetAddress || !command.trim()) return;

    const isBroadcast = targetAddress === 'broadcast';
    const address = isBroadcast ? null : parseInt(targetAddress, 10);
    const targetNode = address !== null ? nodes?.find((n) => n.address === address) : null;

    const entryId = Date.now();
    const entry: CommandHistoryEntry = {
      id: entryId,
      timestamp: new Date(),
      target: isBroadcast ? 'Broadcast (all online)' : (targetNode ? getNodeDisplayName(targetNode) : `Address ${address}`),
      targetAddress: address,
      command: command.trim(),
      status: 'pending',
    };

    setCommandHistory((prev) => [entry, ...prev]);
    const cmdToSend = command.trim();
    setCommand('');

    try {
      await sendMutation.mutateAsync({
        address: isBroadcast ? 'broadcast' : address!,
        cmd: cmdToSend,
      });
      setCommandHistory((prev) =>
        prev.map((h) => (h.id === entryId ? { ...h, status: 'sent' as const } : h))
      );
    } catch (err) {
      setCommandHistory((prev) =>
        prev.map((h) =>
          h.id === entryId
            ? { ...h, status: 'failed' as const, error: (err as Error).message }
            : h
        )
      );
    }
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
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
              >
                <option value="">Select a node...</option>
                <option value="broadcast">Broadcast (all online nodes)</option>
                {nodes?.map((node) => (
                  <option key={node.address} value={node.address.toString()}>
                    {getNodeDisplayName(node)} (addr: {node.address}) {node.online ? '' : '- offline'}
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
              disabled={!targetAddress || !command.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Sending...
                </>
              ) : (
                'Send Command'
              )}
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
                        <div className="flex items-center gap-2">
                          <span className={`${getStatusBadge(entry.status)} badge-sm`}>
                            {entry.status === 'sent'
                              ? 'Sent'
                              : entry.status === 'failed'
                              ? 'Failed'
                              : 'Pending'}
                          </span>
                          {entry.error && (
                            <span
                              className="text-error text-xs truncate max-w-32"
                              title={entry.error}
                            >
                              {entry.error}
                            </span>
                          )}
                        </div>
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
