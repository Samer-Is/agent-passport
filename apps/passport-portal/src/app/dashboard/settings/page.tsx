'use client';

import { useState } from 'react';
import { Card, Button, Input, Alert } from '@/components/ui';

export default function SettingsPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsUpdating(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const displayName = formData.get('displayName') as string;

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsUpdating(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setIsUpdating(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setIsUpdating(false);
      return;
    }

    try {
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setSuccess('Password changed successfully');
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {/* Profile Settings */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>
        <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4">
          <Input
            label="Display Name"
            name="displayName"
            placeholder="Your name"
            maxLength={100}
          />
          <Button type="submit" isLoading={isUpdating}>
            Update Profile
          </Button>
        </form>
      </Card>

      {/* Password Settings */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <Input
            label="Current Password"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Button type="submit" isLoading={isUpdating}>
            Change Password
          </Button>
        </form>
      </Card>

      {/* API Access */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          API Documentation
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Use your API keys to verify agent identity tokens. Include your API key in the
          request header:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm dark:bg-gray-800">
          <code className="text-gray-800 dark:text-gray-200">
{`# Verify an agent token
curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'https://api.agentpassport.dev'}/v1/tokens/verify \\
  -H "X-API-Key: ap_sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"token": "agent_identity_token"}'

# Introspect token details
curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'https://api.agentpassport.dev'}/v1/tokens/introspect \\
  -H "X-API-Key: ap_sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"token": "agent_identity_token"}'`}
          </code>
        </pre>
        <div className="mt-4">
          <a
            href="/docs"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            View Full API Documentation →
          </a>
        </div>
      </Card>
    </div>
  );
}
