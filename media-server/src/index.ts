import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as mediasoup from 'mediasoup';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/media/socket.io/',
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// --- Mediasoup Setup ---
let worker: mediasoup.types.Worker;
let routers: Map<string, mediasoup.types.Router> = new Map();

const mediaCodecs: any[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  }
];

let workerReadyPromise: Promise<void>;

async function createWorker() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    rtcMinPort: 40000,
    rtcMaxPort: 49999
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });
  console.log(`Mediasoup worker created [pid:${worker.pid}]`);
}

workerReadyPromise = createWorker();

// Utility to get or create a router for a specific session
async function getOrCreateRouter(sessionId: string) {
  await workerReadyPromise;
  let router = routers.get(sessionId);
  if (!router) {
    router = await worker.createRouter({ mediaCodecs });
    routers.set(sessionId, router);
    console.log(`Created new router for session: ${sessionId}`);
  }
  return router;
}

const roomProducers: Map<string, Array<{ producerId: string, kind: string, userId: string }>> = new Map();

// --- Socket.IO Signaling ---
io.on('connection', (socket) => {
  console.log(`Media signaling connected: ${socket.id}`);

  socket.on('getRouterRtpCapabilities', async ({ sessionId }, callback) => {
    try {
      socket.join(sessionId); // Crucial for receiving broadcasts
      const router = await getOrCreateRouter(sessionId);
      callback(router.rtpCapabilities);
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  socket.on('getProducers', ({ sessionId }, callback) => {
    const producersInRoom = roomProducers.get(sessionId) || [];
    callback(producersInRoom);
  });

  // Store transports, producers, and consumers per socket
  const transports: Map<string, mediasoup.types.WebRtcTransport> = new Map();
  const producers: Map<string, mediasoup.types.Producer> = new Map();
  const consumers: Map<string, mediasoup.types.Consumer> = new Map();

  socket.on('createWebRtcTransport', async ({ sessionId }, callback) => {
    try {
      const router = await getOrCreateRouter(sessionId);
      const transport = await router.createWebRtcTransport({
        listenInfos: [
          { protocol: 'udp', ip: '0.0.0.0', announcedIp: '127.0.0.1' },
          { protocol: 'tcp', ip: '0.0.0.0', announcedIp: '127.0.0.1' }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      transports.set(transport.id, transport);
      (transport as any).sessionId = sessionId;

      transport.on('dtlsstatechange', (dtlsState: any) => {
        if (dtlsState === 'closed') transport.close();
      });

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        }
      });
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      const transport = transports.get(transportId);
      if (!transport) throw new Error(`Transport ${transportId} not found`);
      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
    try {
      const transport = transports.get(transportId);
      if (!transport) throw new Error(`Transport ${transportId} not found`);
      
      const producer = await transport.produce({ kind, rtpParameters });
      producers.set(producer.id, producer);

      const sessionId = (transport as any).sessionId;
      const user = socket.handshake.auth.user;
      
      if (sessionId && user) {
        // Add to global room producers
        const existing = roomProducers.get(sessionId) || [];
        existing.push({ producerId: producer.id, kind: producer.kind, userId: user.id });
        roomProducers.set(sessionId, existing);

        producer.on('transportclose', () => {
          producer.close();
          const list = roomProducers.get(sessionId) || [];
          roomProducers.set(sessionId, list.filter(p => p.producerId !== producer.id));
        });

        // Notify others in the room
        socket.to(sessionId).emit('new-producer', { producerId: producer.id, kind: producer.kind, userId: user.id });
      }

      callback({ id: producer.id });
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
    try {
      const transport = transports.get(transportId);
      if (!transport) throw new Error(`Transport ${transportId} not found`);

      const sessionId = (transport as any).sessionId;
      const router = routers.get(sessionId);
      if (!router?.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume');
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true
      });
      consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => consumer.close());
      consumer.on('producerclose', () => {
        socket.emit('consumer-closed', { consumerId: consumer.id });
        consumer.close();
        consumers.delete(consumer.id);
      });

      callback({
        params: {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        }
      });
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const consumer = consumers.get(consumerId);
      if (!consumer) throw new Error(`Consumer ${consumerId} not found`);
      await consumer.resume();
      callback({ success: true });
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Media signaling disconnected: ${socket.id}`);
    transports.forEach(t => t.close());
    transports.clear();
    producers.clear();
    consumers.clear();
  });
});

const PORT = 5000;
httpServer.listen(PORT, () => {
  console.log(`Media Server running on port ${PORT}`);
});
