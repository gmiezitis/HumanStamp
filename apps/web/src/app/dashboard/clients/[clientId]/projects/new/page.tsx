'use client';

import { useState, FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProjectPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const { project } = await res.json();
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-stone-900 mb-8">New Project</h1>

        <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-2">
              Project Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="block w-full px-3 py-2 border border-stone-300 rounded-md"
              placeholder="e.g., Autumn Campaign"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Project'}
            </button>
            <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-stone-300 rounded-md hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
