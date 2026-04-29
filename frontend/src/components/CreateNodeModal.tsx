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
    <dialog className="modal modal-open" onClick={handleBackdropClick}>
      <div className="modal-box">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          ✕
        </button>
        <h3 className="font-bold text-lg">Create Node</h3>

        <form onSubmit={handleSubmit} className="mt-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Node Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., sensor-kitchen"
              required
            />
          </div>

          <div className="form-control mt-4">
            <label className="label">
              <span className="label-text">Address</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 1"
              min="0"
              max="65535"
              required
            />
          </div>

          {mutation.isError && (
            <div className="alert alert-error mt-4">
              <span>{(mutation.error as Error).message}</span>
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending || !name.trim() || !address.trim()}
            >
              {mutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating...
                </>
              ) : (
                'Create Node'
              )}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
