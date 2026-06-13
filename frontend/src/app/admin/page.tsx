'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Activity, Users, Clock, ShieldAlert, CheckCircle2, XCircle, Video, Paperclip, LogOut, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format, differenceInMinutes, parseISO } from 'date-fns';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);

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
    // Auth Check
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      router.push('/');
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== 'ADMIN') {
      alert('Access Denied');
      router.push('/');
      return;
    }

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); // polling for updates
    
    return () => {
      clearInterval(interval);
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleForceEnd = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent dialog from opening
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

  // Metrics Logic
  const activeCount = sessions.filter(s => s.status === 'ACTIVE').length;
  const todaySessions = sessions.filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString());
  const totalParticipants = sessions.filter(s => s.status === 'ACTIVE').reduce((acc, curr) => acc + curr.participants.length + 1, 0); // +1 for Agent
  
  const closedSessions = sessions.filter(s => s.status === 'CLOSED');
  const avgDurationMins = closedSessions.length > 0 
    ? closedSessions.reduce((acc, s) => acc + differenceInMinutes(parseISO(s.updatedAt), parseISO(s.createdAt)), 0) / closedSessions.length
    : 0;

  // Graph Logic - Group by hour for today
  const chartData = Array.from({ length: 24 }).map((_, i) => {
    const count = todaySessions.filter(s => parseISO(s.createdAt).getHours() === i).length;
    return { time: `${i}:00`, count };
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-10">
      
      {/* Top Navigation */}
      <header className="bg-[#111111] border-b border-gray-800 sticky top-0 z-10 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="font-bold text-black">A</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">AtomAssist <span className="font-light text-gray-400">| OpsCenter</span></span>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleLogout} variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        
        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-gray-200 shadow-sm transition-all hover:shadow-md">
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
          <Card className="border-gray-200 shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Calls Today</p>
                  <p className="text-2xl font-bold text-gray-900">{todaySessions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm transition-all hover:shadow-md">
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
          <Card className="border-gray-200 shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-900">{avgDurationMins.toFixed(1)}m</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Chart Row */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="bg-white border-b border-gray-100 pb-4">
            <CardTitle className="text-lg text-gray-900">Today's Call Volume Analytics</CardTitle>
            <CardDescription>Number of sessions initiated per hour</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="time" stroke="#888" fontSize={12} tickMargin={10} />
                  <YAxis allowDecimals={false} stroke="#888" fontSize={12} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#eab308" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Live Session Table */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-white border-b border-gray-100 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-gray-900">Global Session Monitor</CardTitle>
              <CardDescription>Click on any session to view detailed analytics and assets.</CardDescription>
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
                    <TableRow 
                      key={session.id} 
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedSession(session)}
                    >
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
                        {/* Indicators for assets */}
                        <div className="flex gap-2 mt-2">
                          {session.recordings?.length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded">
                              <Video className="w-3 h-3" /> {session.recordings.length}
                            </span>
                          )}
                          {session.messages?.filter((m:any) => m.fileUrl).length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                              <Paperclip className="w-3 h-3" /> {session.messages.filter((m:any) => m.fileUrl).length}
                            </span>
                          )}
                        </div>
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
                          onClick={(e) => handleForceEnd(e, session.id)}
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

      </main>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl border-b pb-4">
              <Info className="w-5 h-5 text-primary" /> Session Intelligence
            </DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-8 pt-4">
              
              {/* Meta Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Session Title</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedSession.title}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Agent</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedSession.agent.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date Created</p>
                  <p className="text-sm font-semibold text-gray-900">{format(parseISO(selectedSession.createdAt), 'PPpp')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <Badge variant={selectedSession.status === 'ACTIVE' ? 'default' : 'secondary'} className={selectedSession.status === 'ACTIVE' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                    {selectedSession.status}
                  </Badge>
                </div>
              </div>

              {/* Assets Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Recordings */}
                <div>
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Video className="w-4 h-4 text-purple-500" /> Recordings ({selectedSession.recordings?.length || 0})
                  </h4>
                  {selectedSession.recordings?.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {selectedSession.recordings.map((rec: any, i: number) => (
                        <a key={rec.id} href={`http://localhost:4000${rec.url}`} target="_blank" className="bg-white border border-gray-200 px-4 py-3 rounded-lg flex items-center justify-between hover:border-purple-300 transition-colors shadow-sm group">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Footage {i + 1}</span>
                          <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded">View WebM</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200">No recordings saved for this session.</p>
                  )}
                </div>

                {/* Files Shared */}
                <div>
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Paperclip className="w-4 h-4 text-blue-500" /> Files Shared ({selectedSession.messages?.filter((m: any) => m.fileUrl).length || 0})
                  </h4>
                  {selectedSession.messages?.filter((m: any) => m.fileUrl).length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {selectedSession.messages.filter((m: any) => m.fileUrl).map((m: any) => (
                        <div key={m.id} className="bg-white border border-gray-200 px-4 py-3 rounded-lg flex items-center justify-between hover:border-blue-300 transition-colors shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{m.fileName}</span>
                            <span className="text-xs text-gray-400 mt-0.5">from {m.sender.name}</span>
                          </div>
                          <a href={`http://localhost:4000${m.fileUrl}`} target="_blank" className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded transition-colors">
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200">No files were shared in chat.</p>
                  )}
                </div>

              </div>

              {/* Event Timeline */}
              <div>
                <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-gray-500" /> Event Timeline
                </h4>
                {selectedSession.events?.length > 0 ? (
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 max-h-[300px] overflow-y-auto">
                    <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                      {selectedSession.events.map((ev: any) => (
                        <div key={ev.id} className="relative pl-6">
                          <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-white"></div>
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800">
                              <span className="font-semibold">{ev.payload?.name || 'System'}</span> triggered <span className="font-mono text-xs bg-gray-200 px-1 rounded">{ev.type}</span>
                            </span>
                            <span className="text-xs text-gray-400 mt-1">{format(parseISO(ev.timestamp), 'hh:mm:ss a')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200">No events recorded.</p>
                )}
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
