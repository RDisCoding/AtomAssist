'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Video, Headphones, ArrowRight } from 'lucide-react';

export default function JoinSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Authenticate / Register Customer
      const authRes = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!authRes.ok) {
        const errData = await authRes.json();
        throw new Error(errData.error || 'Auth failed');
      }
      
      const authData = await authRes.json();
      sessionStorage.setItem('token', authData.token);
      sessionStorage.setItem('user', JSON.stringify(authData.user));

      // 2. Redirect to session room
      router.push(`/session/${unwrappedParams.sessionId}`);

    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error joining session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans">
      
      {/* Left Side: Branding & Info (Hidden on very small screens, responsive on others) */}
      <div className="hidden md:flex md:w-1/2 bg-gray-50 border-r border-gray-200 flex-col justify-center items-center p-12 lg:p-24 relative overflow-hidden">
        <div className="absolute top-8 left-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="font-bold text-black">A</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">AtomAssist</span>
        </div>

        <div className="w-full max-w-md space-y-8 z-10">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight">Expert Support,<br/>Face to Face.</h1>
            <p className="mt-4 text-lg text-gray-600">Connect securely with an Atomberg support specialist through live video assistance to resolve your issues instantly.</p>
          </div>

          <div className="space-y-6 pt-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                <Video className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Live Video Diagnostics</h3>
                <p className="text-sm text-gray-600 mt-1">Show us the problem using your smartphone camera.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                <Headphones className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Real-Time Chat</h3>
                <p className="text-sm text-gray-600 mt-1">Exchange text and links directly with the agent.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-1">
                <ShieldCheck className="w-5 h-5 text-yellow-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Secure & Private</h3>
                <p className="text-sm text-gray-600 mt-1">Your stream is end-to-end encrypted and completely private.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary rounded-full blur-3xl opacity-20"></div>
      </div>

      {/* Right Side: Join Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 min-h-screen md:min-h-0 bg-white relative">
        
        {/* Mobile Header (Only visible on small screens) */}
        <div className="md:hidden absolute top-6 left-6 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="font-bold text-black">A</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">AtomAssist</span>
        </div>

        <div className="w-full max-w-sm space-y-8 mt-12 md:mt-0">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-900">Join Support Session</h2>
            <p className="text-sm text-gray-500 mt-2 font-mono bg-gray-100 py-1 px-2 rounded inline-block">ID: {unwrappedParams.sessionId.split('-')[0]}-{unwrappedParams.sessionId.split('-')[1]}</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 border-gray-300 focus:ring-primary focus:border-primary text-base"
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 border-gray-300 focus:ring-primary focus:border-primary text-base"
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-black hover:bg-gray-800 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Connecting...' : (
                <>
                  Join Support Call <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-gray-400 pt-4">
              By joining, you agree to Atomberg's Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
