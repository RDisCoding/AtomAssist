import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const router = express.Router();

const DUMMY_USERS: Record<string, any> = {
  'agent@atomberg.com': { name: 'Agent Smith', role: 'AGENT', password: 'password123' },
  'customer@example.com': { name: 'Jane Doe', role: 'CUSTOMER', password: 'password123' },
  'admin@atomberg.com': { name: 'Admin User', role: 'ADMIN', password: 'password123' },
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const dummy = DUMMY_USERS[email];
  if (!dummy || dummy.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials. Use a valid dummy account.' });
  }

  try {
    // Ensure the dummy user is present in the database so the UI can retrieve their real DB record
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: dummy.name,
          role: dummy.role
        }
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
