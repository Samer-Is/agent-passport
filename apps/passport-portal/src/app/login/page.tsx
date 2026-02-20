import { LoginForm } from '@/components/auth-forms';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <LoginForm />
    </div>
  );
}
