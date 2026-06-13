import express from 'express';
import { authenticate, requireAgent, AuthRequest } from '../middleware/auth';
import prisma from '../prisma';

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

// End session (Agent only)
router.delete('/:id', authenticate, requireAgent, async (req, res) => {
  const { id } = req.params;

  try {
    const session = await prisma.session.update({
      where: { id },
      data: { status: 'CLOSED' }
    });

    res.json({ message: 'Session closed successfully', session });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
