'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/sessions/admin');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); // polling for updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Command Center</h1>
            <p className="text-gray-500 mt-1">Global view of all platform support sessions.</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>Exit Admin</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <Card key={session.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`absolute top-0 left-0 w-full h-1 ${session.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{session.title}</CardTitle>
                    <CardDescription className="text-xs mt-1 font-mono">ID: {session.id.split('-')[0]}...</CardDescription>
                  </div>
                  <Badge variant={session.status === 'ACTIVE' ? 'default' : 'secondary'} className={session.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : ''}>
                    {session.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Agent</p>
                    <p className="text-sm font-medium">{session.agent.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Participants</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {session.participants.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">None yet</span>
                      ) : (
                        session.participants.map((p: any) => (
                          <Badge key={p.id} variant="outline" className="text-xs">
                            {p.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {sessions.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-lg border border-dashed">
              No support sessions active right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
