'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Users, Clock, ShieldAlert, CheckCircle2, XCircle, Video, Download } from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

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
    
    // In a real production app, events would be streamed via Socket.IO directly to the admin panel.
    // For this hackathon, we simulate a global event stream based on session data changes.
    const mockEventStream = setInterval(() => {
      if (Math.random() > 0.7) {
        const fakeEvents = [
          "Customer 'Jane Doe' joined Session: Broken Fan",
          "Agent 'John Smith' enabled camera",
          "Customer uploaded diagnostic image",
          "Session 'WiFi Issue' ended by Agent"
        ];
        const randomEvent = fakeEvents[Math.floor(Math.random() * fakeEvents.length)];
        setEvents(prev => [{ time: new Date(), text: randomEvent }, ...prev].slice(0, 15));
      }
    }, 4000);
    
    return () => {
      clearInterval(interval);
      clearInterval(mockEventStream);
    };
  }, []);

  const handleForceEnd = async (sessionId: string) => {
    if (!confirm('Are you sure you want to force end this session? All participants will be disconnected immediately.')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:4000/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'ACTIVE').length;
  const totalParticipants = sessions.filter(s => s.status === 'ACTIVE').reduce((acc, curr) => acc + curr.participants.length + 1, 0); // +1 for Agent

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Navigation */}
      <header className="bg-[#111111] border-b border-gray-800 sticky top-0 z-10 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="font-bold text-black">A</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">AtomAssist <span className="font-light text-gray-400">| OpsCenter</span></span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" className="gap-2 bg-transparent border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800" onClick={() => router.push('/dashboard')}>
                Back to Agent Portal
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
        
        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Live Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Calls Today</p>
                  <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Connected Users</p>
                  <p className="text-2xl font-bold text-gray-900">{totalParticipants}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-900">4m 12s</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Live Session Table */}
          <Card className="lg:col-span-2 shadow-sm border-gray-200">
            <CardHeader className="bg-white border-b border-gray-100 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-gray-900">Global Session Monitor</CardTitle>
                <CardDescription>Overview of all active and past support instances.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary-foreground border-primary/20">Live Polling</Badge>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[200px] font-semibold text-gray-600">Session</TableHead>
                    <TableHead className="font-semibold text-gray-600">Agent</TableHead>
                    <TableHead className="font-semibold text-gray-600">Customers</TableHead>
                    <TableHead className="font-semibold text-gray-600">Status</TableHead>
                    <TableHead className="text-right font-semibold text-gray-600">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                        No operations active.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <div className="text-sm text-gray-900 truncate max-w-[150px]">{session.title}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{session.id.split('-')[0]}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700 font-medium">{session.agent.name}</span>
                        </TableCell>
                        <TableCell>
                          {session.participants.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {session.participants.map((p: any) => (
                                <Badge key={p.id} variant="outline" className="text-xs bg-white text-gray-600 border-gray-200">
                                  {p.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Waiting...</span>
                          )}
                          {session.recordings?.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1">
                              {session.recordings.map((rec: any, idx: number) => (
                                <a key={rec.id} href={`http://localhost:4000${rec.url}`} target="_blank" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                  <Video className="w-3 h-3" /> Recording {idx + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-green-100 text-green-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                              <XCircle className="w-3 h-3" />
                              Closed
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleForceEnd(session.id)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700" 
                            disabled={session.status !== 'ACTIVE'}
                          >
                            <ShieldAlert className="w-4 h-4 mr-1 hidden sm:block" /> Force End
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Real-Time Events Panel */}
          <Card className="lg:col-span-1 shadow-sm border-gray-200 flex flex-col h-[500px]">
            <CardHeader className="bg-white border-b border-gray-100 pb-4">
              <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" /> System Events
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="text-center text-sm text-gray-400 pt-10">Listening for global events...</div>
                ) : (
                  events.map((evt, i) => (
                    <div key={i} className="flex gap-3 text-sm animate-in fade-in slide-in-from-right-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-gray-800">{evt.text}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{evt.time.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}
