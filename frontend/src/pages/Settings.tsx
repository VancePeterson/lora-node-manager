import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchNodes, fetchSettings, fetchMqttStatus, updateSettings } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { getNodeDisplayName } from '../types';
import type { AppSettings } from '../types';

export default function Settings() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const { data: mqttStatus } = useQuery({
    queryKey: ['mqttStatus'],
    queryFn: fetchMqttStatus,
    refetchInterval: 3000,
  });

  const [formData, setFormData] = useState<AppSettings>({
    mqtt_host: '',
    mqtt_port: 1883,
    mqtt_username: null,
    mqtt_password: null,
    mqtt_topic_prefix: 'lora',
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['mqttStatus'] });
      setHasChanges(false);
    },
  });

  const handleChange = (field: keyof AppSettings, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Appearance */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Appearance</h2>
          <p className="text-sm text-base-content/60 mb-4">
            Customize the look and feel of the application.
          </p>

          <div className="form-control w-full max-w-xs">
            <label className="label">
              <span className="label-text">Theme</span>
            </label>
            <select
              className="select select-bordered"
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </div>

      {/* MQTT Broker */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">MQTT Broker</h2>
          <p className="text-sm text-base-content/60 mb-4">
            Configure the MQTT broker connection. Changes will reconnect the client.
          </p>

          {settingsLoading ? (
            <div className="flex items-center gap-3">
              <span className="loading loading-spinner loading-md"></span>
              <span>Loading settings...</span>
            </div>
          ) : (
            <>
              {/* Connection Status */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    mqttStatus?.connected ? 'bg-success' : 'bg-error'
                  }`}
                />
                <span className="font-medium">
                  {mqttStatus?.connected ? 'Connected' : 'Disconnected'}
                </span>
                {mqttStatus?.connected && mqttStatus.host && (
                  <span className="text-base-content/60">
                    to {mqttStatus.host}:{mqttStatus.port}
                  </span>
                )}
                {mqttStatus?.error && (
                  <span className="text-error text-sm">- {mqttStatus.error}</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Host / IP Address</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.mqtt_host}
                    onChange={(e) => handleChange('mqtt_host', e.target.value)}
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Port</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={formData.mqtt_port}
                    onChange={(e) => handleChange('mqtt_port', parseInt(e.target.value) || 1883)}
                    min="1"
                    max="65535"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Username (optional)</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.mqtt_username ?? ''}
                    onChange={(e) => handleChange('mqtt_username', e.target.value || null)}
                    placeholder="Leave blank if not required"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Password (optional)</span>
                  </label>
                  <input
                    type="password"
                    className="input input-bordered"
                    value={formData.mqtt_password ?? ''}
                    onChange={(e) => handleChange('mqtt_password', e.target.value || null)}
                    placeholder="Leave blank if not required"
                  />
                </div>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text">Topic Prefix</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered max-w-xs"
                  value={formData.mqtt_topic_prefix}
                  onChange={(e) => handleChange('mqtt_topic_prefix', e.target.value)}
                  placeholder="e.g., lora"
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    Subscribes to {formData.mqtt_topic_prefix || 'lora'}/#
                  </span>
                </label>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!hasChanges || updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Saving...
                    </>
                  ) : (
                    'Save & Reconnect'
                  )}
                </button>
                {hasChanges && (
                  <button className="btn btn-ghost" onClick={handleReset}>
                    Reset
                  </button>
                )}
              </div>

              {updateMutation.isError && (
                <div className="alert alert-error mt-4">
                  <span>Error: {(updateMutation.error as Error).message}</span>
                </div>
              )}

              {updateMutation.isSuccess && (
                <div className="alert alert-success mt-4">
                  <span>Settings saved. Reconnecting to broker...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Node Configuration */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Node Configuration</h2>
          <p className="text-sm text-base-content/60 mb-4">
            Manage registered nodes. Nodes are auto-discovered from MQTT messages.
          </p>
          {nodes && nodes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Display Name</th>
                    <th>MQTT Topic</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => (
                    <tr key={node.address}>
                      <td className="font-mono">{node.address}</td>
                      <td>{getNodeDisplayName(node)}</td>
                      <td className="font-mono text-sm text-base-content/60">
                        lora/{node.address}/*
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/60">
              <p>No nodes registered yet</p>
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">About</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <tbody>
                <tr>
                  <td className="font-medium w-48">Version</td>
                  <td>0.1.0</td>
                </tr>
                <tr>
                  <td className="font-medium">Total Nodes</td>
                  <td>{nodes?.length ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
