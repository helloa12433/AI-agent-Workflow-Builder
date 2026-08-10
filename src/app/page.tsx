'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [email, setEmail] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      const { token, user } = await res.json();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      window.location.href = '/dashboard';
    } else {
      alert('Login failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50 dark:bg-zinc-900">
      <main className="flex flex-col gap-8 w-full max-w-sm bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-center">Login to Workflow Builder</h1>
        <p className="text-sm text-center text-gray-500">Sign in to access your organization's workflows.</p>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email" 
            className="px-4 py-2 border rounded-lg dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Login
          </button>
        </form>
      </main>
    </div>
  );
}
