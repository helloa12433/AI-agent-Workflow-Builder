'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Workflow Builder</h1>
        <button 
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
          }}
          className="text-sm font-medium hover:underline text-gray-500"
        >
          Logout
        </button>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        {children}
      </main>
    </div>
  );
}
