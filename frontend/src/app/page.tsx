'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('agent@atomberg.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email !== 'agent@atomberg.com' && email !== 'admin@atomberg.com') {
      alert('For demo purposes, only agent@atomberg.com or admin@atomberg.com are allowed.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'AGENT' })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.user.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="font-bold text-black">A</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">AtomAssist</span>
            <span className="ml-2 text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full uppercase tracking-wider">Agent Portal</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          
          <div className="p-8 pb-6 text-center space-y-2 bg-gray-900 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
            <ShieldCheck className="w-10 h-10 mx-auto text-primary mb-4" />
            <h1 className="text-2xl font-bold tracking-tight">Secure Login</h1>
            <p className="text-sm text-gray-400">Authenticate to access the Atomberg Command Center.</p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-gray-700">Work Email</label>
              <Input
                id="email"
                type="email"
                placeholder="agent@atomberg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 border-gray-200 focus:border-primary focus:ring-primary text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 border-gray-200 focus:border-primary focus:ring-primary text-base"
                required
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-black hover:bg-gray-800 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {loading ? 'Authenticating...' : (
                <>
                  Enter Dashboard <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-gray-400 pt-2">
              Protected by Atomberg Single Sign-On (SSO). <br/> For demo purposes, credentials are locked.
            </p>
          </form>
        </div>
      </main>
      
    </div>
  );
}
