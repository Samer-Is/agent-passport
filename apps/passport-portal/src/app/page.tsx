import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-4xl text-center">
        <h1 className="text-5xl font-bold mb-6">
          🛂 Agent Passport
        </h1>
        <p className="text-2xl text-gray-600 dark:text-gray-300 mb-4">
          Sign in with Google, but for Agents
        </p>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          OAuth-like identity and verification layer for AI agents. 
          Secure authentication using Ed25519 keys, challenge-response auth, 
          and intelligent risk scoring.
        </p>
        
        <div className="flex gap-4 justify-center mb-16">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Dashboard
          </Link>
          <a
            href="https://github.com/zerobase-labs/agent-passport/blob/main/docs/INTEGRATION.md"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Documentation
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">🔐 For Agents</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Register your Ed25519 public key, prove identity via challenge-response, 
              and get short-lived JWT tokens.
            </p>
          </div>
          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">🛡️ For App Builders</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Verify agent identities with a single API call. 
              Get risk recommendations: allow, throttle, or block.
            </p>
          </div>
          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">📊 Risk Scoring</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Rule-based risk engine evaluates agent age, behavior patterns, 
              and rate limit violations.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
