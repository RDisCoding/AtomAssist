'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MessageSquare, Users as UsersIcon, PhoneOff, Clock, Activity, ChevronDown, Paperclip, CircleDot, Square } from 'lucide-react';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Media state
  const [device, setDevice] = useState<mediasoupClient.Device | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Record<string, { stream: MediaStream, video: boolean, audio: boolean, name: string, role: string }>>({});
  
  const [sendTransport, setSendTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [recvTransport, setRecvTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [videoProducer, setVideoProducer] = useState<mediasoupClient.types.Producer | null>(null);
  const [audioProducer, setAudioProducer] = useState<mediasoupClient.types.Producer | null>(null);

  const [isVideoPaused, setIsVideoPaused] = useState(true);
  const [isAudioPaused, setIsAudioPaused] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'events'>('chat');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Timer
    const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Scroll to bottom of chat
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab, mobileSidebarOpen]);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    
    if (!storedUser || !token) {
      router.push('/');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const socket = io((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'), { auth: { token }, query: { sessionId } });
    const mSocket = io((process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:5000'), { auth: { user: parsedUser } });

    socket.on('connect', () => {
      setEvents(prev => [...prev, `Connected to support server.`]);
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
      setEvents(prev => [...prev, `${data.user.name} joined the session.`]);
      setParticipants(prev => {
        if(prev.find(p => p.id === data.user.id)) return prev;
        return [...prev, data.user];
      });
    });

    socket.on('user-left', (data: any) => {
      setEvents(prev => [...prev, `${data.user.name} left the session.`]);
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

    socket.on('session-ended', () => {
      alert('This session has been forcibly ended by an administrator.');
      
      // Cleanup locally
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      socket.disconnect();
      mSocket.disconnect();
      
      if (user?.role === 'AGENT' || user?.role === 'ADMIN') {
        router.push('/dashboard');
      } else {
        sessionStorage.clear();
        router.push('/');
      }
    });

    mSocket.on('connect', () => {
      initMediasoup(mSocket);
    });

    setMainSocket(socket);
    setMediaSocket(mSocket);

    return () => {
      socket.disconnect();
      mSocket.disconnect();
    };
  }, [sessionId, router]);

  // useEffect for localStream removed since we use ref callback now

  const initMediasoup = async (mSocket: Socket) => {
    try {
      const routerRtpCapabilities = await new Promise<any>((resolve) => {
        mSocket.emit('getRouterRtpCapabilities', { sessionId }, resolve);
      });

      const dev = new mediasoupClient.Device();
      await dev.load({ routerRtpCapabilities });
      setDevice(dev);

      const recv = await createRecvTransport(mSocket, dev);

      mSocket.on('new-producer', ({ producerId, userId }: any) => {
        consumeRemoteTrack(mSocket, producerId, userId, dev, recv);
      });

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
        const participant = participants.find(p => p.id === userId);
        const pName = participant?.name || 'Remote Participant';
        const pRole = participant?.role || 'CUSTOMER';
        const existing = prev[userId] || { stream: new MediaStream(), video: true, audio: true, name: pName, role: pRole };
        
        // Force a new MediaStream instance so the React ref callback fires again to attach it
        const newStream = new MediaStream(existing.stream.getTracks());
        newStream.addTrack(consumer.track);
        
        return { ...prev, [userId]: { ...existing, stream: newStream } };
      });

      mSocket.emit('resumeConsumer', { consumerId: consumer.id }, () => {});

    } catch (error) {
      console.error('Consume error:', error);
    }
  };

  const toggleVideo = async () => {
    if (!localStream) {
      await initializeMedia(true, !isAudioPaused);
      return;
    }
    
    if (videoProducer && mainSocket) {
      const isPaused = videoProducer.paused;
      if (isPaused) {
        videoProducer.resume();
        localStream.getVideoTracks().forEach(t => t.enabled = true);
      } else {
        videoProducer.pause();
        localStream.getVideoTracks().forEach(t => t.enabled = false);
      }
      setIsVideoPaused(!isPaused);
      mainSocket.emit('media-state', { sessionId, video: isPaused, audio: !isAudioPaused });
    } else if (mainSocket) {
      // If we don't have a producer yet, initialize media
      await initializeMedia(true, !isAudioPaused);
    }
  };

  const toggleAudio = async () => {
    if (!localStream) {
      await initializeMedia(!isVideoPaused, true);
      return;
    }

    if (audioProducer && mainSocket) {
      const isPaused = audioProducer.paused;
      if (isPaused) {
        audioProducer.resume();
        localStream.getAudioTracks().forEach(t => t.enabled = true);
      } else {
        audioProducer.pause();
        localStream.getAudioTracks().forEach(t => t.enabled = false);
      }
      setIsAudioPaused(!isPaused);
      mainSocket.emit('media-state', { sessionId, video: !isVideoPaused, audio: isPaused });
    } else if (mainSocket) {
      await initializeMedia(!isVideoPaused, true);
    }
  };

  const initializeMedia = async (videoEnabled: boolean, audioEnabled: boolean) => {
    if (!device || !mediaSocket || !mainSocket) return;
    try {
      let transport = sendTransport;
      if (!transport) transport = await createSendTransport(mediaSocket, device);

      const stream = localStream || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!localStream) {
        setLocalStream(stream);
        localStreamRef.current = stream;
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      // Set initial states
      if (videoTrack) videoTrack.enabled = videoEnabled;
      if (audioTrack) audioTrack.enabled = audioEnabled;

      if (videoTrack && !videoProducer) {
        const vp = await transport.produce({ track: videoTrack });
        if (!videoEnabled) vp.pause();
        setVideoProducer(vp);
      }
      if (audioTrack && !audioProducer) {
        const ap = await transport.produce({ track: audioTrack });
        if (!audioEnabled) ap.pause();
        setAudioProducer(ap);
      }

      setIsVideoPaused(!videoEnabled);
      setIsAudioPaused(!audioEnabled);
      
      mainSocket.emit('media-state', { sessionId, video: videoEnabled, audio: audioEnabled });
    } catch (err) {
      console.error(err);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const handleLeave = () => {
    if (videoProducer) videoProducer.close();
    if (audioProducer) audioProducer.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    
    if (mainSocket) mainSocket.disconnect();
    if (mediaSocket) mediaSocket.disconnect();
    
    if (user?.role === 'AGENT' || user?.role === 'ADMIN') {
      router.push('/dashboard');
    } else {
      sessionStorage.clear();
      router.push('/');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !selectedFile) return;

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64Data = evt.target?.result as string;
        mainSocket?.emit('send-message', {
          sessionId,
          content: chatInput,
          attachment: { name: selectedFile.name, data: base64Data }
        });
        setChatInput('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(selectedFile);
    } else {
      mainSocket?.emit('send-message', { sessionId, content: chatInput });
      setChatInput('');
    }
  };

  const toggleRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];
        stream.getTracks().forEach(t => t.stop());

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result;
          const token = sessionStorage.getItem('token') || localStorage.getItem('token');
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/sessions/${sessionId}/recording`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ videoData: base64data })
          });
          alert('Recording successfully uploaded and saved to the server!');
        };
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Recording failed:', err);
      alert('Could not start recording. Screen sharing permission required.');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!user) return null;

  const activeStreamsCount = 1 + participants.filter(p => p.id !== user.id).length;
  const gridClass = activeStreamsCount === 1 ? 'grid-cols-1' : activeStreamsCount === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="flex flex-col h-screen bg-[#111111] text-white font-sans overflow-hidden">
      
      {/* Top Bar */}
      <header className="h-14 flex-shrink-0 border-b border-gray-800 bg-[#1E1E1E] flex items-center justify-between px-4 sm:px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="font-bold text-black text-sm">A</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold truncate max-w-[200px]">Session: {sessionId.split('-')[0]}</h1>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Connected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-mono text-gray-300">{formatTime(callDuration)}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Video Area */}
        <div className={`flex-1 flex flex-col p-2 sm:p-4 transition-all duration-300 ${mobileSidebarOpen ? 'hidden md:flex' : 'flex'} min-h-0`}>
          <div className={`flex-1 min-h-0 grid gap-2 sm:gap-4 ${gridClass} items-center justify-center auto-rows-fr`}>
            
            {/* Local Video */}
            <div className="bg-[#1E1E1E] w-full h-full min-h-0 rounded-xl overflow-hidden relative border border-gray-800 shadow-xl group">
              {isVideoPaused ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-[#1E1E1E]">
                  <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-gray-400">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm">Camera is off</span>
                </div>
              ) : (
                <video
                  ref={(el) => { if (el && localStream && el.srcObject !== localStream) el.srcObject = localStream; }}
                  autoPlay playsInline muted
                  className="w-full h-full object-contain transform scale-x-[-1] bg-black"
                />
              )}
              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs sm:text-sm font-medium flex gap-2 items-center border border-white/10">
                {user.name} (You)
                {isAudioPaused && <MicOff className="w-3.5 h-3.5 text-red-400" />}
              </div>
            </div>

            {/* Remote Videos */}
            {participants.filter(p => p.id !== user.id).map((p) => {
              const peer = remotePeers[p.id];
              const isVideoOff = !peer || !peer.video;
              const isAudioOff = !peer || !peer.audio;
              return (
                <div key={p.id} className="bg-[#1E1E1E] w-full h-full min-h-0 rounded-xl overflow-hidden relative border border-gray-800 shadow-xl group">
                  {isVideoOff ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-[#1E1E1E]">
                      <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                        <span className="text-2xl font-bold text-gray-400">{p.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-sm">Camera is off</span>
                    </div>
                  ) : (
                    <video
                      autoPlay playsInline
                      className="w-full h-full object-contain bg-black"
                      ref={(el) => { if (el && peer.stream && el.srcObject !== peer.stream) el.srcObject = peer.stream; }}
                    />
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs sm:text-sm font-medium flex gap-2 items-center border border-white/10">
                    {p.name} <span className="text-gray-400 text-[10px] uppercase border border-gray-600 px-1 rounded">{p.role}</span>
                    {isAudioOff && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Control Bar */}
          <div className="h-20 mt-4 flex items-center justify-center gap-3 sm:gap-6">
            <Button 
              onClick={toggleAudio} 
              variant="outline" 
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-none ${isAudioPaused ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}
            >
              {isAudioPaused ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </Button>
            
            <Button 
              onClick={toggleVideo} 
              variant="outline" 
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-none ${isVideoPaused ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}
            >
              {isVideoPaused ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
            </Button>

            <Button 
              onClick={handleLeave} 
              variant="destructive" 
              className="w-12 h-12 sm:w-16 sm:h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 shadow-lg px-0 sm:px-6"
            >
              <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>

            {user?.role === 'AGENT' && (
              <Button 
                onClick={toggleRecording} 
                variant="outline" 
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-none ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-white" /> : <CircleDot className="w-5 h-5 sm:w-6 sm:h-6" />}
              </Button>
            )}

            <div className="w-px h-8 bg-gray-800 mx-2 hidden sm:block"></div>

            <Button 
              onClick={() => {
                setActiveTab('chat');
                setMobileSidebarOpen(!mobileSidebarOpen);
              }} 
              variant="outline" 
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-none md:hidden ${mobileSidebarOpen && activeTab === 'chat' ? 'bg-primary text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </Button>

            <Button 
              onClick={() => {
                setActiveTab('participants');
                setMobileSidebarOpen(!mobileSidebarOpen);
              }} 
              variant="outline" 
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-none md:hidden ${mobileSidebarOpen && activeTab === 'participants' ? 'bg-primary text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              <UsersIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Right Sidebar (Desktop) / Sliding Drawer (Mobile) */}
        <div className={`
          absolute md:relative right-0 top-0 h-full w-full md:w-80 lg:w-96 bg-[#1E1E1E] border-l border-gray-800 flex flex-col transition-transform duration-300 z-20
          ${mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
          
          {/* Mobile Close Button */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-[#1A1A1A]">
            <span className="font-semibold text-gray-200 capitalize">{activeTab}</span>
            <Button variant="ghost" size="sm" onClick={() => setMobileSidebarOpen(false)} className="text-gray-400">
              <ChevronDown className="w-5 h-5" />
            </Button>
          </div>

          {/* Tabs Navigation (Desktop) */}
          <div className="hidden md:flex p-2 gap-1 bg-[#1A1A1A] border-b border-gray-800">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'chat' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Chat
            </button>
            <button 
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'participants' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              People
            </button>
            <button 
              onClick={() => setActiveTab('events')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'events' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Events
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
            
            {activeTab === 'chat' && (
              <div className="absolute inset-0 flex flex-col bg-[#1E1E1E]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-sm text-gray-500 mt-10">No messages yet. Start the conversation!</div>
                  )}
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === user.id;
                    return (
                      <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-gray-500 mb-1 px-1">{msg.sender.name}</span>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-primary text-black rounded-tr-sm' : 'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
                          {msg.content}
                          {msg.fileUrl && (
                            <div className="mt-2">
                              {msg.fileType?.startsWith('image/') ? (
                                <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${msg.fileUrl}`} alt={msg.fileName} className="max-w-[200px] rounded-md border border-white/20" />
                              ) : (
                                <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${msg.fileUrl}`} target="_blank" className="flex items-center gap-1 text-blue-400 hover:underline break-all">
                                  <Paperclip className="w-4 h-4 flex-shrink-0" /> {msg.fileName}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-gray-800 bg-[#1A1A1A]">
                  {selectedFile && (
                    <div className="mb-2 text-xs text-gray-400 flex items-center justify-between bg-gray-800 p-2 rounded">
                      <span className="truncate">{selectedFile.name}</span>
                      <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-red-400 hover:text-red-300">Remove</button>
                    </div>
                  )}
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)} 
                    />
                    <Button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      variant="ghost" 
                      className="px-2 hover:bg-gray-800 text-gray-400 hover:text-gray-200"
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    <Input 
                      placeholder="Type a message..." 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      className="flex-1 bg-gray-800 border-gray-700 text-white focus:ring-primary focus:border-primary h-10"
                    />
                    <Button type="submit" size="sm" className="bg-primary text-black hover:bg-yellow-500 h-10 px-4">Send</Button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="space-y-3">
                <div className="p-3 bg-gray-800 rounded-lg flex items-center justify-between border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{user.name} (You)</p>
                      <p className="text-[10px] text-gray-400 uppercase">{user.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-gray-400">
                    {isAudioPaused ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
                    {isVideoPaused ? <VideoOff className="w-4 h-4 text-red-400" /> : <VideoIcon className="w-4 h-4" />}
                  </div>
                </div>

                {participants.map(p => {
                  const peerState = remotePeers[p.id];
                  return (
                    <div key={p.id} className="p-3 bg-gray-800/50 rounded-lg flex items-center justify-between border border-transparent hover:border-gray-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-sm">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-300">{p.name}</p>
                          <p className="text-[10px] text-gray-500 uppercase">{p.role}</p>
                        </div>
                      </div>
                      {peerState && (
                        <div className="flex gap-2 text-gray-500">
                          {!peerState.audio ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-gray-400" />}
                          {!peerState.video ? <VideoOff className="w-4 h-4 text-red-400" /> : <VideoIcon className="w-4 h-4 text-gray-400" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-3 font-mono text-xs">
                {events.map((evt, i) => (
                  <div key={i} className="flex gap-3 text-gray-400 border-l-2 border-gray-700 pl-3 py-1">
                    <span className="text-gray-600">{(new Date()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span>{evt}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
