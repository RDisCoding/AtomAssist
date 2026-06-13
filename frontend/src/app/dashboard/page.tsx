'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/');
      return;
    }
    setToken(storedToken);
    fetchSessions(storedToken);
  }, [router]);

  const fetchSessions = async (authToken: string) => {
    const res = await fetch('http://localhost:4000/api/sessions', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      setSessions(data);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionTitle) return;

    const res = await fetch('http://localhost:4000/api/sessions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ title: newSessionTitle })
    });

    if (res.ok) {
      setNewSessionTitle('');
      fetchSessions(token);
    }
  };

  const handleEndSession = async (id: string) => {
    const res = await fetch(`http://localhost:4000/api/sessions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      fetchSessions(token);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Agent Dashboard</h1>
        <Button variant="outline" onClick={() => {
          localStorage.clear();
          router.push('/');
        }}>Logout</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Support Session</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Input 
            placeholder="Issue Title (e.g. Broken Fan)" 
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
          />
          <Button onClick={handleCreateSession}>Create Session</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <h2 className="text-2xl font-semibold mt-4">Active & Past Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-gray-500">No sessions found.</p>
        ) : (
          sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{session.title}</h3>
                  <p className="text-sm text-gray-500">Status: {session.status}</p>
                  <p className="text-sm text-gray-500">
                    Invite Link: <a href={`/join/${session.id}`} className="text-blue-500 underline" target="_blank" rel="noreferrer">/join/{session.id}</a>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => router.push(`/session/${session.id}`)}>Enter Room</Button>
                  {session.status === 'ACTIVE' && (
                    <Button variant="destructive" onClick={() => handleEndSession(session.id)}>End Session</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
