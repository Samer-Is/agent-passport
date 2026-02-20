'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Alert } from '@/components/ui';
import { createApp } from '@/lib/api';

export default function NewAppPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    try {
      // We need to get the userId from the session - for client components we'll use a server action
      const response = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create app');
      }

      // Show the API key
      setCreatedKey(data.key.fullKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create app');
    } finally {
      setIsLoading(false);
    }
  }

  if (createdKey) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
              Application Created!
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Your API key has been generated. Copy it now - you won&apos;t be able to see it again.
            </p>
          </div>

          <Alert type="warning" className="mt-6">
            <strong>Important:</strong> This API key will only be shown once. Please save it securely.
          </Alert>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your API Key
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                readOnly
                value={createdKey}
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(createdKey)}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => router.push('/dashboard/apps')}
            >
              View All Apps
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setCreatedKey(null);
                setError(null);
              }}
            >
              Create Another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Application</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Register a new application to verify agent identities
        </p>
      </div>

      <Card>
        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Application Name"
            name="name"
            placeholder="My Awesome App"
            required
            maxLength={100}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (optional)
            </label>
            <textarea
              name="description"
              placeholder="A brief description of your application..."
              rows={3}
              maxLength={500}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isLoading}>
              Create Application
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
