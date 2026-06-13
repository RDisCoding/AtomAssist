'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SessionRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const { sessionId } = use(params);
  
  const [mainSocket, setMainSocket] = useState<Socket | null>(null);
  const [mediaSocket, setMediaSocket] = useState<Socket | null>(null);
  
  const [user, setUser] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Media state
  const [device, setDevice] = useState<mediasoupClient.Device | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // remoteStreams: userId -> { stream, video: boolean, audio: boolean }
  const [remotePeers, setRemotePeers] = useState<Record<string, { stream: MediaStream, video: boolean, audio: boolean, name: string }>>({});
  
  const [sendTransport, setSendTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [recvTransport, setRecvTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [videoProducer, setVideoProducer] = useState<mediasoupClient.types.Producer | null>(null);
  const [audioProducer, setAudioProducer] = useState<mediasoupClient.types.Producer | null>(null);

  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('customer_token');
    const storedUser = localStorage.getItem('user') || localStorage.getItem('customer_user');
    
    if (!token || !storedUser) {
      router.push('/');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const socket = io('http://localhost:4000', { auth: { token }, query: { sessionId } });
    const mSocket = io('http://localhost:5000');

    socket.on('connect', () => {
      setEvents(prev => [...prev, `Connected to main server.`]);
      socket.emit('join-room', { sessionId, user: parsedUser });
      socket.emit('fetch-messages', { sessionId }, (fetched: any[]) => setMessages(fetched));
    });

    socket.on('new-message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('room-state', (data: any) => {
      setParticipants(data.existingUsers);
    });

    socket.on('user-joined', (data: any) => {
      setEvents(prev => [...prev, `${data.user.name} joined.`]);
      setParticipants(prev => {
        if(prev.find(p => p.id === data.user.id)) return prev;
        return [...prev, data.user];
      });
    });

    socket.on('user-left', (data: any) => {
      setEvents(prev => [...prev, `${data.user.name} left.`]);
      setParticipants(prev => prev.filter(p => p.id !== data.user.id));
      setRemotePeers(prev => {
        const next = { ...prev };
        delete next[data.user.id];
        return next;
      });
    });

    socket.on('media-state', (data: any) => {
      setRemotePeers(prev => {
        if (!prev[data.userId]) return prev;
        return {
          ...prev,
          [data.userId]: { ...prev[data.userId], video: data.video, audio: data.audio }
        };
      });
    });

    mSocket.on('connect', () => {
      initMediasoup(mSocket);
    });

    mSocket.on('new-producer', ({ producerId, userId }) => {
      consumeRemoteTrack(mSocket, producerId, userId);
    });

    setMainSocket(socket);
    setMediaSocket(mSocket);

    return () => {
      socket.disconnect();
      mSocket.disconnect();
    };
  }, [sessionId, router]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const initMediasoup = async (mSocket: Socket) => {
    try {
      const routerRtpCapabilities = await new Promise<any>((resolve) => {
        mSocket.emit('getRouterRtpCapabilities', { sessionId }, resolve);
      });

      const dev = new mediasoupClient.Device();
      await dev.load({ routerRtpCapabilities });
      setDevice(dev);
      setEvents(prev => [...prev, `Mediasoup device ready.`]);

      const recv = await createRecvTransport(mSocket, dev);

      mSocket.emit('getProducers', { sessionId }, (existingProducers: any[]) => {
        existingProducers.forEach(p => {
          consumeRemoteTrack(mSocket, p.producerId, p.userId, dev, recv);
        });
      });

    } catch (error: any) {
      console.error(error);
    }
  };

  const createSendTransport = async (mSocket: Socket, dev: mediasoupClient.Device) => {
    const params = await new Promise<any>((resolve, reject) => {
      mSocket.emit('createWebRtcTransport', { sessionId }, (res: any) => {
        if (res.error) reject(res.error); else resolve(res.params);
      });
    });

    const transport = dev.createSendTransport(params);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      mSocket.emit('connectTransport', { transportId: transport.id, dtlsParameters }, (res: any) => {
        if (res.error) errback(res.error); else callback();
      });
    });

    transport.on('produce', async (parameters, callback, errback) => {
      mSocket.emit('produce', {
        transportId: transport.id,
        kind: parameters.kind,
        rtpParameters: parameters.rtpParameters,
      }, (res: any) => {
        if (res.error) errback(res.error); else callback({ id: res.id });
      });
    });

    setSendTransport(transport);
    return transport;
  };

  const createRecvTransport = async (mSocket: Socket, dev: mediasoupClient.Device) => {
    const params = await new Promise<any>((resolve, reject) => {
      mSocket.emit('createWebRtcTransport', { sessionId }, (res: any) => {
        if (res.error) reject(res.error); else resolve(res.params);
      });
    });

    const transport = dev.createRecvTransport(params);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      mSocket.emit('connectTransport', { transportId: transport.id, dtlsParameters }, (res: any) => {
        if (res.error) errback(res.error); else callback();
      });
    });

    setRecvTransport(transport);
    return transport;
  };

  const consumeRemoteTrack = async (mSocket: Socket, producerId: string, userId: string, dev = device, transport = recvTransport) => {
    if (!dev || !transport) return;

    try {
      const { params } = await new Promise<any>((resolve) => {
        mSocket.emit('consume', {
          transportId: transport.id,
          producerId,
          rtpCapabilities: dev.rtpCapabilities
        }, resolve);
      });

      const consumer = await transport.consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters
      });

      setRemotePeers(prev => {
        const pName = participants.find(p => p.id === userId)?.name || 'Remote Participant';
        const existing = prev[userId] || { stream: new MediaStream(), video: true, audio: true, name: pName };
        existing.stream.addTrack(consumer.track);
        return { ...prev, [userId]: existing };
      });

      mSocket.emit('resumeConsumer', { consumerId: consumer.id }, () => {});

    } catch (error) {
      console.error('Consume error:', error);
    }
  };

  const startMedia = async () => {
    if (!device || !mediaSocket || !mainSocket) return;
    try {
      let transport = sendTransport;
      if (!transport) transport = await createSendTransport(mediaSocket, device);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        const vp = await transport.produce({ track: videoTrack });
        setVideoProducer(vp);
      }
      if (audioTrack) {
        const ap = await transport.produce({ track: audioTrack });
        setAudioProducer(ap);
      }

      setEvents(prev => [...prev, `Publishing media...`]);
      setIsVideoPaused(false);
      setIsAudioPaused(false);
      
      mainSocket.emit('media-state', { sessionId, video: true, audio: true });
    } catch (err) {
      console.error(err);
      alert('Could not start camera');
    }
  };

  const stopMedia = () => {
    if (videoProducer) videoProducer.close();
    if (audioProducer) audioProducer.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setVideoProducer(null);
    setAudioProducer(null);
    
    if (mainSocket) {
      mainSocket.emit('media-state', { sessionId, video: false, audio: false });
    }
  };

  const toggleVideo = () => {
    if (videoProducer && mainSocket) {
      const isPaused = videoProducer.paused;
      if (isPaused) {
        videoProducer.resume();
        localStream?.getVideoTracks().forEach(t => t.enabled = true);
      } else {
        videoProducer.pause();
        localStream?.getVideoTracks().forEach(t => t.enabled = false);
      }
      setIsVideoPaused(!isPaused);
      mainSocket.emit('media-state', { sessionId, video: isPaused, audio: !isAudioPaused });
    }
  };

  const toggleAudio = () => {
    if (audioProducer && mainSocket) {
      const isPaused = audioProducer.paused;
      if (isPaused) {
        audioProducer.resume();
        localStream?.getAudioTracks().forEach(t => t.enabled = true);
      } else {
        audioProducer.pause();
        localStream?.getAudioTracks().forEach(t => t.enabled = false);
      }
      setIsAudioPaused(!isPaused);
      mainSocket.emit('media-state', { sessionId, video: !isVideoPaused, audio: isPaused });
    }
  };

  const handleLeave = () => {
    stopMedia();
    if (mainSocket) mainSocket.disconnect();
    if (mediaSocket) mediaSocket.disconnect();
    if (user?.role === 'AGENT') router.push('/dashboard');
    else {
      localStorage.clear();
      router.push('/');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !mainSocket) return;
    mainSocket.emit('send-message', { sessionId, content: chatInput });
    setChatInput('');
  };

  if (!user) return null;

  // Calculate dynamic grid columns based on number of active streams
  const activeStreamsCount = (localStream ? 1 : 0) + Object.keys(remotePeers).length;
  const gridClass = activeStreamsCount === 1 ? 'grid-cols-1' : activeStreamsCount === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Support Session: {sessionId}</h1>
          <Button variant="destructive" onClick={handleLeave}>Leave Call</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 flex flex-col min-h-[500px]">
            <CardHeader className="flex flex-row justify-between items-center py-4 border-b">
              <CardTitle>Video Room</CardTitle>
              <div className="flex gap-2">
                {!localStream ? (
                  <Button onClick={startMedia}>Start Camera</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={toggleVideo}>
                      {isVideoPaused ? 'Turn Video On' : 'Turn Video Off'}
                    </Button>
                    <Button variant="outline" onClick={toggleAudio}>
                      {isAudioPaused ? 'Unmute Mic' : 'Mute Mic'}
                    </Button>
                    <Button variant="destructive" onClick={stopMedia}>Stop Sharing</Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4 bg-gray-100 flex flex-col justify-center">
              
              {activeStreamsCount === 0 && (
                <div className="text-center text-gray-400 py-20">Waiting for participants to turn on camera...</div>
              )}

              <div className={`grid gap-4 w-full h-full ${gridClass}`}>
                {/* Local Video */}
                {localStream && (
                  <div className="bg-gray-900 aspect-video rounded-lg overflow-hidden relative shadow-lg">
                    {isVideoPaused ? (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-800">
                        Camera Off
                      </div>
                    ) : (
                      <video
                        ref={localVideoRef}
                        autoPlay playsInline muted
                        className="w-full h-full object-cover transform scale-x-[-1]"
                      />
                    )}
                    <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded text-white text-sm font-semibold flex gap-2 items-center">
                      {user.name} (You) {isAudioPaused && <span className="text-red-400 text-xs px-1">Muted</span>}
                    </div>
                  </div>
                )}

                {/* Remote Videos */}
                {Object.entries(remotePeers).map(([id, peer]) => (
                  <div key={id} className="bg-gray-800 aspect-video rounded-lg overflow-hidden relative shadow-lg">
                    {!peer.video ? (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-700">
                        Camera Off
                      </div>
                    ) : (
                      <video
                        autoPlay playsInline
                        className="w-full h-full object-cover"
                        ref={(el) => { if (el && el.srcObject !== peer.stream) el.srcObject = peer.stream; }}
                      />
                    )}
                    <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded text-white text-sm font-semibold flex gap-2 items-center">
                      {peer.name || 'Remote'} {!peer.audio && <span className="text-red-400 text-xs px-1">Muted</span>}
                    </div>
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4 flex flex-col h-[500px]">
            <Card className="flex-shrink-0">
              <CardHeader className="py-2">
                <CardTitle className="text-md">Participants ({participants.length + 1})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pb-3 text-xs max-h-[100px] overflow-y-auto">
                <div className="p-1 bg-blue-50 text-blue-800 rounded font-medium border border-blue-100">
                  {user.name} (You) - {user.role}
                </div>
                {participants.map(p => (
                  <div key={p.id} className="p-1 border rounded bg-white">
                    {p.name} - <span className="text-gray-500">{p.role}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="py-2 border-b">
                <CardTitle className="text-md">Chat & Events</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-2 text-sm p-3 font-sans">
                {events.map((evt, i) => (
                  <div key={`evt-${i}`} className="text-xs text-gray-400 text-center italic">{evt}</div>
                ))}
                {messages.map((msg, i) => (
                  <div key={`msg-${i}`} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-500 mb-1">{msg.sender.name}</span>
                    <div className={`px-3 py-2 rounded-lg max-w-[80%] ${msg.senderId === user.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </CardContent>
              <div className="p-3 border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input 
                    placeholder="Type a message..." 
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="sm">Send</Button>
                </form>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
