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

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

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
      } catch (error) {
        console.error('Socket leave error:', error);
      }
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

  socket.on('send-message', async ({ sessionId, content }) => {
    const user = (socket as any).user;
    if (user && sessionId && content.trim()) {
      try {
        const message = await prisma.message.create({
          data: {
            sessionId,
            senderId: user.id,
            content
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
