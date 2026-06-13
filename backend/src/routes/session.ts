import express from 'express';
import { authenticate, requireAgent, AuthRequest } from '../middleware/auth';
import prisma from '../prisma';
import { io } from '../index';

const router = express.Router();

// Create a new session (Agent only)
router.post('/', authenticate, requireAgent, async (req, res) => {
  const authReq = req as AuthRequest;
  const { title } = req.body;
  const agentId = authReq.user!.id;

  try {
    const session = await prisma.session.create({
      data: {
        title: title || 'New Support Session',
        agentId,
        status: 'ACTIVE'
      }
    });

    res.json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List sessions
router.get('/', authenticate, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        agent: {
          select: { id: true, name: true, email: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, role: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(sessions);
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin dashboard route (Public for hackathon)
router.get('/admin', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        agent: { select: { id: true, name: true, email: true } },
        participants: { include: { user: { select: { id: true, name: true, role: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    // Flatten participants for easier frontend rendering
    const formatted = sessions.map(s => ({
      ...s,
      participants: s.participants.map(p => p.user)
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End session (Agent or Admin)
router.delete('/:id', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: 'Session ID is required' });
    return;
  }

  if (authReq.user!.role !== 'AGENT' && authReq.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const session = await prisma.session.update({
      where: { id: id as string },
      data: { status: 'CLOSED' }
    });

    io.to(id).emit('session-ended');

    res.json({ message: 'Session closed successfully', session });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
