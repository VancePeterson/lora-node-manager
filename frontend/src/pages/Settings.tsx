import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchNodes, fetchSettings, fetchMqttStatus, updateSettings } from '../api/client';
import type { AppSettings } from '../types';

export default function Settings() {
  const queryClient = useQueryClient();

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
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <h2>MQTT Broker</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Configure the MQTT broker connection. Changes will reconnect the client.
        </p>

        {settingsLoading ? (
          <p>Loading settings...</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: mqttStatus?.connected ? '#16a34a' : '#dc2626',
                }}
              />
              <span style={{ fontWeight: 500 }}>
                {mqttStatus?.connected ? 'Connected' : 'Disconnected'}
              </span>
              {mqttStatus?.connected && mqttStatus.host && (
                <span style={{ color: '#6b7280' }}>
                  to {mqttStatus.host}:{mqttStatus.port}
                </span>
              )}
              {mqttStatus?.error && (
                <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>
                  - {mqttStatus.error}
                </span>
              )}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label htmlFor="mqtt-host">Host / IP Address</label>
                <input
                  type="text"
                  id="mqtt-host"
                  value={formData.mqtt_host}
                  onChange={(e) => handleChange('mqtt_host', e.target.value)}
                  placeholder="e.g., 192.168.1.100"
                />
              </div>
              <div className="form-group">
                <label htmlFor="mqtt-port">Port</label>
                <input
                  type="number"
                  id="mqtt-port"
                  value={formData.mqtt_port}
                  onChange={(e) => handleChange('mqtt_port', parseInt(e.target.value) || 1883)}
                  min="1"
                  max="65535"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label htmlFor="mqtt-username">Username (optional)</label>
                <input
                  type="text"
                  id="mqtt-username"
                  value={formData.mqtt_username ?? ''}
                  onChange={(e) => handleChange('mqtt_username', e.target.value || null)}
                  placeholder="Leave blank if not required"
                />
              </div>
              <div className="form-group">
                <label htmlFor="mqtt-password">Password (optional)</label>
                <input
                  type="password"
                  id="mqtt-password"
                  value={formData.mqtt_password ?? ''}
                  onChange={(e) => handleChange('mqtt_password', e.target.value || null)}
                  placeholder="Leave blank if not required"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="mqtt-prefix">Topic Prefix</label>
              <input
                type="text"
                id="mqtt-prefix"
                value={formData.mqtt_topic_prefix}
                onChange={(e) => handleChange('mqtt_topic_prefix', e.target.value)}
                placeholder="e.g., lora"
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Subscribes to {formData.mqtt_topic_prefix || 'lora'}/#
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save & Reconnect'}
              </button>
              {hasChanges && (
                <button className="btn btn-secondary" onClick={handleReset}>
                  Reset
                </button>
              )}
            </div>

            {updateMutation.isError && (
              <p style={{ color: '#dc2626', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                Error: {(updateMutation.error as Error).message}
              </p>
            )}

            {updateMutation.isSuccess && (
              <p style={{ color: '#16a34a', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                Settings saved. Reconnecting to broker...
              </p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Node Configuration</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Manage registered nodes. Nodes are auto-discovered from MQTT messages.
        </p>
        {nodes && nodes.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.name}>
                  <td>{node.name}</td>
                  <td>{node.address}</td>
                  <td>{node.node_type}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>No nodes registered yet</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>About</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ fontWeight: 500, width: '200px' }}>Version</td>
              <td>0.1.0</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 500 }}>Total Nodes</td>
              <td>{nodes?.length ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
