import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import authRoutes from './routes/auth';
import sessionRoutes from './routes/session';
import prisma from './prisma';
import fs from 'fs';
import path from 'path';

dotenv.config();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8 // 100 MB for file sharing
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', async ({ sessionId, user }) => {
    socket.join(sessionId);
    
    // Attach to socket for disconnect tracking
    (socket as any).user = user;
    (socket as any).sessionId = sessionId;

    try {
      // Find who is already in the room
      const sockets = await io.in(sessionId).fetchSockets();
      const existingUsers = sockets
        .filter(s => s.id !== socket.id)
        .map(s => (s as any).user)
        .filter(u => u);

      // Send the current participants to the newcomer
      socket.emit('room-state', { existingUsers });

      // Broadcast to others in the room
      socket.to(sessionId).emit('user-joined', { user });

      // Log to DB
      await prisma.event.create({
        data: {
          sessionId,
          userId: user.id,
          type: 'JOIN',
          payload: { name: user.name }
        }
      });
      // Try tracking participant in DB
      await prisma.participant.upsert({
        where: { sessionId_userId: { sessionId, userId: user.id } },
        update: {},
        create: { sessionId, userId: user.id }
      });
    } catch (error) {
      console.error('Socket join error:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    const user = (socket as any).user;
    const sessionId = (socket as any).sessionId;
    
    if (user && sessionId) {
      // 15 seconds grace period for reconnection
      setTimeout(async () => {
        const sockets = await io.in(sessionId).fetchSockets();
        const stillInRoom = sockets.some(s => (s as any).user?.id === user.id);
        
        if (!stillInRoom) {
          socket.to(sessionId).emit('user-left', { user });
          
          try {
            await prisma.event.create({
              data: {
                sessionId,
                userId: user.id,
                type: 'LEAVE',
                payload: { name: user.name }
              }
            });
            await prisma.participant.updateMany({
              where: { sessionId, userId: user.id },
              data: { leftAt: new Date() }
            });
          } catch (error) {
            console.error('Socket leave error:', error);
          }
        }
      }, 15000);
    }
  });

  socket.on('fetch-messages', async ({ sessionId }, callback) => {
    try {
      const messages = await prisma.message.findMany({
        where: { sessionId },
        include: { sender: { select: { name: true } } },
        orderBy: { timestamp: 'asc' }
      });
      callback(messages);
    } catch (error) {
      console.error(error);
      callback([]);
    }
  });

  socket.on('send-message', async ({ sessionId, content, attachment }) => {
    const user = (socket as any).user;
    if (user && sessionId && (content.trim() || attachment)) {
      try {
        let fileUrl: string | undefined;
        let fileType: string | undefined;
        let fileName: string | undefined;
        
        if (attachment) {
          const matches = attachment.data.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            fileType = matches[1];
            fileName = attachment.name;
            const buffer = Buffer.from(matches[2], 'base64');
            const uniqueName = `${Date.now()}-${fileName}`;
            fs.writeFileSync(path.join(uploadsDir, uniqueName), buffer);
            fileUrl = `/uploads/${uniqueName}`;
          }
        }

        const message = await prisma.message.create({
          data: {
            sessionId,
            senderId: user.id,
            content: content || '',
            fileUrl,
            fileType,
            fileName
          },
          include: { sender: { select: { name: true } } }
        });
        io.to(sessionId).emit('new-message', message);
      } catch (error) {
        console.error('Chat error:', error);
      }
    }
  });

  socket.on('media-state', ({ sessionId, video, audio }) => {
    const user = (socket as any).user;
    if (user && sessionId) {
      socket.to(sessionId).emit('media-state', { userId: user.id, video, audio });
    }
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };
