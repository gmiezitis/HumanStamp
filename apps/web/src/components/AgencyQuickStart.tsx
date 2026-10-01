'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AgencyQuickStart({
  workspaces,
}: {
  workspaces: { id: string; name: string }[];
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id || '');
  const [workspaceName, setWorkspaceName] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/onboarding/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(workspaceId ? { workspaceId } : { workspaceName }),
          clientName,
          projectName,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Could not create the handoff project.');
      router.push(data.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Network error. Please try again.'
      );
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5"
    >
      {workspaces.length > 0 && (
        <div>
          <label
            htmlFor="start-workspace"
            className="block text-sm font-medium mb-2"
          >
            Agency workspace
          </label>
          <select
            id="start-workspace"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            className="w-full rounded-lg border border-stone-300 p-3"
          >
            <option value="">Create a new workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!workspaceId && (
        <div>
          <label
            htmlFor="start-agency"
            className="block text-sm font-medium mb-2"
          >
            Agency name
          </label>
          <input
            id="start-agency"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            autoComplete="organization"
            maxLength={100}
            required
            className="w-full rounded-lg border border-stone-300 p-3"
            placeholder="Your agency"
          />
        </div>
      )}
      <div>
        <label
          htmlFor="start-client"
          className="block text-sm font-medium mb-2"
        >
          New client name
        </label>
        <input
          id="start-client"
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
          required
          maxLength={100}
          className="w-full rounded-lg border border-stone-300 p-3"
          placeholder="The brand you are delivering to"
        />
        <p className="text-xs text-stone-500 mt-2">
          Creates a new client. For an existing client, start a project from
          that client’s page.
        </p>
      </div>
      <div>
        <label
          htmlFor="start-project"
          className="block text-sm font-medium mb-2"
        >
          Campaign or video name
        </label>
        <input
          id="start-project"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          required
          maxLength={100}
          className="w-full rounded-lg border border-stone-300 p-3"
          placeholder="Spring campaign — final cut"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="bg-red-50 rounded-lg p-3 text-sm text-red-900"
        >
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="hs-button hs-button-dark w-full"
        type="submit"
      >
        {busy ? 'Creating your project…' : 'Create project and upload cut →'}
      </button>
      <p className="text-xs text-stone-500">
        No client email is sent during setup. You choose the reviewer after
        uploading.
      </p>
    </form>
  );
}
