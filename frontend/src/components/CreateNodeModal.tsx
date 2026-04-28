import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNode } from '../api/client';

interface CreateNodeModalProps {
  onClose: () => void;
}

export default function CreateNodeModal({ onClose }: CreateNodeModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createNode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !address.trim()) return;

    mutation.mutate({
      name: name.trim(),
      address: parseInt(address, 10),
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal">
        <div className="modal-header">
          <h2>Create Node</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="node-name">Node Name</label>
              <input
                type="text"
                id="node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., sensor-kitchen"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="node-address">Address</label>
              <input
                type="number"
                id="node-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 1"
                min="0"
                max="65535"
                required
              />
            </div>
            {mutation.isError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {(mutation.error as Error).message}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending || !name.trim() || !address.trim()}
            >
              {mutation.isPending ? 'Creating...' : 'Create Node'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
