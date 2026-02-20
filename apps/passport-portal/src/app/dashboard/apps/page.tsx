import { requireAuth } from '@/lib/actions';
import { getApps, AppWithKeys } from '@/lib/api';
import { Card, Badge, Button } from '@/components/ui';
import Link from 'next/link';

export default async function AppsPage() {
  const session = await requireAuth();
  
  let apps: AppWithKeys[] = [];
  
  try {
    const result = await getApps(session.userId!);
    apps = result.apps;
  } catch (e) {
    console.error('Failed to load apps:', e);
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Applications</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage your applications and API keys
          </p>
        </div>
        <Link href="/dashboard/apps/new">
          <Button>
            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Application
          </Button>
        </Link>
      </div>

      {apps.length === 0 ? (
        <Card className="text-center">
          <div className="py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No applications yet</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create your first application to start verifying agent identities.
            </p>
            <Link href="/dashboard/apps/new" className="mt-4 inline-block">
              <Button>Create Application</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link key={app.id} href={`/dashboard/apps/${app.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <Badge variant={app.status === 'active' ? 'success' : 'warning'}>
                    {app.status}
                  </Badge>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{app.name}</h3>
                {app.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                    {app.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    {app.keys.filter(k => k.status === 'active').length} active key(s)
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Created {new Date(app.createdAt).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
