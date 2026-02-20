'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Alert, Badge, Input } from '@/components/ui';

interface AppKey {
  id: string;
  name: string | null;
  keyPrefix: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface App {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  keys: AppKey[];
}

export default function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [app, setApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setAppId(p.id));
  }, [params]);

  useEffect(() => {
    if (appId) {
      fetchApp();
    }
  }, [appId]);

  async function fetchApp() {
    try {
      const response = await fetch(`/api/apps/${appId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch app');
      }
      const data = await response.json();
      setApp(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load app');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingKey(true);

    try {
      const response = await fetch(`/api/apps/${appId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create key');
      }

      const data = await response.json();
      setNewKey(data.fullKey);
      setNewKeyName('');
      fetchApp(); // Refresh to show new key
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/apps/${appId}/keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke key');
      }

      fetchApp(); // Refresh
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke key');
    }
  }

  async function handleDeleteApp() {
    try {
      const response = await fetch(`/api/apps/${appId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete app');
      }

      router.push('/dashboard/apps');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete app');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !app) {
    return (
      <Alert type="error">
        {error}
        <Link href="/dashboard/apps" className="ml-2 underline">
          Back to apps
        </Link>
      </Alert>
    );
  }

  if (!app) {
    return (
      <Alert type="error">
        Application not found.
        <Link href="/dashboard/apps" className="ml-2 underline">
          Back to apps
        </Link>
      </Alert>
    );
  }

  const activeKeys = app.keys.filter(k => k.status === 'active');
  const revokedKeys = app.keys.filter(k => k.status === 'revoked');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {app.name}
            </h1>
            <Badge variant={app.status === 'active' ? 'success' : 'default'}>
              {app.status}
            </Badge>
          </div>
          {app.description && (
            <p className="mt-1 text-gray-600 dark:text-gray-400">{app.description}</p>
          )}
        </div>
        <Button variant="secondary" onClick={() => router.push('/dashboard/apps')}>
          Back to Apps
        </Button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* New Key Alert */}
      {newKey && (
        <Alert type="warning">
          <div>
            <strong>New API Key Created!</strong>
            <p className="mt-1 text-sm">
              Copy this key now - you won&apos;t be able to see it again.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                readOnly
                value={newKey}
                className="block flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(newKey)}
              >
                Copy
              </Button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="mt-2 text-sm text-gray-600 underline hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* App Info */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Application Details
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">App ID</dt>
            <dd className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
              {app.id}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {new Date(app.createdAt).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Keys</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {activeKeys.length}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {new Date(app.updatedAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </Card>

      {/* API Keys */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            API Keys
          </h2>
        </div>

        {/* Create Key Form */}
        <form onSubmit={handleCreateKey} className="mt-4 flex gap-2">
          <Input
            placeholder="Key name (optional)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" isLoading={isCreatingKey}>
            Create Key
          </Button>
        </form>

        {/* Active Keys */}
        {activeKeys.length > 0 ? (
          <div className="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
            {activeKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                      {key.keyPrefix}...
                    </span>
                    {key.name && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({key.name})
                      </span>
                    )}
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRevokeKey(key.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No active API keys. Create one above.
          </p>
        )}

        {/* Revoked Keys */}
        {revokedKeys.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Revoked Keys
            </h3>
            <div className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
              {revokedKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between py-3 opacity-60">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {key.keyPrefix}...
                      </span>
                      {key.name && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({key.name})
                        </span>
                      )}
                      <Badge variant="default">Revoked</Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900/50">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Danger Zone
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Deleting this application will revoke all API keys and permanently remove all data.
        </p>

        {showDeleteConfirm ? (
          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Are you sure? This cannot be undone.
            </p>
            <Button variant="danger" onClick={handleDeleteApp}>
              Yes, Delete
            </Button>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Application
          </Button>
        )}
      </Card>
    </div>
  );
}
