'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, MonitorPlay, LogOut, Copy, Plus, Activity } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

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

  const copyToClipboard = (id: string) => {
    const link = `${window.location.origin}/join/${id}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied!');
  };

  const activeCount = sessions.filter(s => s.status === 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col font-sans transition-colors duration-300">
      {/* Top Navigation */}
      <header className="bg-white dark:bg-card border-b border-gray-200 dark:border-border sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black dark:bg-primary rounded-md flex items-center justify-center">
                <span className="font-bold text-primary dark:text-black">A</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-foreground">AtomAssist <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">Agent Portal</span></span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button variant="outline" className="gap-2 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-full px-5 text-gray-900 dark:text-gray-100" onClick={() => {
                localStorage.clear();
                router.push('/');
              }}>
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Secure Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Customer Support Command Center</h1>
            <p className="mt-3 text-lg text-gray-300 max-w-2xl">Manage your active support sessions, dispatch secure links, and resolve customer issues via live diagnostic video.</p>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/20 blur-3xl rounded-full transform translate-x-1/2 -translate-y-1/4"></div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-md bg-white dark:bg-card hover:shadow-lg transition-shadow">
            <CardContent className="p-6 flex flex-col justify-center relative overflow-hidden">
              <div className="flex items-center justify-between z-10">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Sessions</h3>
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"><Activity className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
              </div>
              <p className="text-4xl font-black mt-4 text-gray-900 dark:text-foreground z-10">{activeCount}</p>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-green-50 dark:bg-green-900/10 rounded-full blur-xl"></div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white dark:bg-card hover:shadow-lg transition-shadow">
            <CardContent className="p-6 flex flex-col justify-center relative overflow-hidden">
              <div className="flex items-center justify-between z-10">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customers Today</h3>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><Users className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              </div>
              <p className="text-4xl font-black mt-4 text-gray-900 dark:text-foreground z-10">{sessions.length}</p>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-xl"></div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white dark:bg-card hover:shadow-lg transition-shadow">
            <CardContent className="p-6 flex flex-col justify-center relative overflow-hidden">
              <div className="flex items-center justify-between z-10">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Resolution</h3>
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg"><Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" /></div>
              </div>
              <p className="text-4xl font-black mt-4 text-gray-900 dark:text-foreground z-10">4m 12s</p>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-50 dark:bg-orange-900/10 rounded-full blur-xl"></div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white dark:bg-card hover:shadow-lg transition-shadow">
            <CardContent className="p-6 flex flex-col justify-center relative overflow-hidden">
              <div className="flex items-center justify-between z-10">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Online Agents</h3>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><MonitorPlay className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
              </div>
              <p className="text-4xl font-black mt-4 text-gray-900 dark:text-foreground z-10">1</p>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-purple-50 dark:bg-purple-900/10 rounded-full blur-xl"></div>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Create Session */}
          <Card className="lg:col-span-1 sticky top-24 shadow-sm border-gray-200 dark:border-border dark:bg-card transition-colors">
            <CardHeader className="bg-gray-50 dark:bg-muted border-b border-gray-100 dark:border-border pb-4">
              <CardTitle className="text-lg text-gray-900 dark:text-foreground">New Session</CardTitle>
              <CardDescription className="dark:text-muted-foreground">Generate an invite link for a customer.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Issue Description</label>
                <Input 
                  placeholder="e.g. Broken Ceiling Fan" 
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="w-full border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary dark:bg-background"
                />
              </div>
              <Button 
                onClick={handleCreateSession} 
                className="w-full bg-primary hover:bg-yellow-500 text-black font-semibold gap-2"
              >
                <Plus className="w-4 h-4" /> Create Support Session
              </Button>
            </CardContent>
          </Card>

          {/* Session List */}
          <Card className="lg:col-span-2 shadow-sm border-gray-200 dark:border-border dark:bg-card overflow-hidden transition-colors">
            <CardHeader className="bg-white dark:bg-card border-b border-gray-100 dark:border-border pb-4">
              <CardTitle className="text-lg text-gray-900 dark:text-foreground">Session History</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50 dark:bg-muted">
                  <TableRow className="dark:border-border">
                    <TableHead className="w-[300px] font-semibold text-gray-600 dark:text-gray-300">Issue</TableHead>
                    <TableHead className="font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">Participants</TableHead>
                    <TableHead className="font-semibold text-gray-600 dark:text-gray-300">Status</TableHead>
                    <TableHead className="text-right font-semibold text-gray-600 dark:text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-gray-500">
                        No active sessions. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <div className="text-sm text-gray-900">{session.title}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{session.id.split('-')[0]}...</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {session.participants.length > 0 ? (
                            <div className="flex -space-x-2">
                              {session.participants.map((p: any) => (
                                <div key={p.id} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600" title={p.user.name}>
                                  {p.user.name.charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={session.status === 'ACTIVE' ? 'default' : 'secondary'} className={session.status === 'ACTIVE' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600'}>
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {session.status === 'ACTIVE' && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => copyToClipboard(session.id)} title="Copy Invite Link" className="hidden sm:flex border-gray-300">
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button variant="default" size="sm" onClick={() => router.push(`/session/${session.id}`)} className="bg-black hover:bg-gray-800 text-white">
                                  Join
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleEndSession(session.id)} title="End Session" className="hidden sm:flex">
                                  End
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
