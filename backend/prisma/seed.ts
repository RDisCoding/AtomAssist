import prisma from '../src/prisma';

async function main() {
  console.log('🌱 Wiping existing database...');
  
  // Wipe tables in reverse relational order
  await prisma.event.deleteMany({});
  await prisma.recording.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ Database cleared!');
  
  console.log('🌱 Seeding users...');
  
  const admin = await prisma.user.create({
    data: { email: 'admin@atomberg.com', name: 'Super Admin', role: 'ADMIN' }
  });
  
  const agent1 = await prisma.user.create({
    data: { email: 'agent@atomberg.com', name: 'Agent Smith', role: 'AGENT' }
  });
  
  const agent2 = await prisma.user.create({
    data: { email: 'agent2@atomberg.com', name: 'Agent Neo', role: 'AGENT' }
  });

  const customer1 = await prisma.user.create({
    data: { email: 'customer@example.com', name: 'John Doe', role: 'CUSTOMER' }
  });
  
  const customer2 = await prisma.user.create({
    data: { email: 'jane@example.com', name: 'Jane Doe', role: 'CUSTOMER' }
  });

  const users = [customer1, customer2];
  const agents = [agent1, agent2];

  console.log('🌱 Seeding randomized sessions...');

  // Generate 15 random sessions distributed across the last 12 hours
  const now = new Date();
  
  for (let i = 0; i < 15; i++) {
    const selectedAgent = agents[Math.floor(Math.random() * agents.length)];
    const selectedCustomer = users[Math.floor(Math.random() * users.length)];
    
    // Random hour offset (0 to 12 hours ago)
    const hourOffset = Math.floor(Math.random() * 12);
    // Random duration (5 to 45 minutes)
    const durationMinutes = Math.floor(Math.random() * 40) + 5;
    
    const createdAt = new Date(now.getTime() - hourOffset * 60 * 60 * 1000 - durationMinutes * 60 * 1000);
    const updatedAt = new Date(createdAt.getTime() + durationMinutes * 60 * 1000);
    
    const isLive = i === 0 || i === 1; // Make 2 sessions LIVE

    const session = await prisma.session.create({
      data: {
        title: `Customer Issue #${Math.floor(Math.random() * 9000) + 1000}`,
        agentId: selectedAgent.id,
        status: isLive ? 'ACTIVE' : 'CLOSED',
        createdAt: createdAt,
        updatedAt: isLive ? now : updatedAt,
      }
    });

    // Add Agent Participant
    await prisma.participant.create({
      data: {
        sessionId: session.id,
        userId: selectedAgent.id,
        joinedAt: createdAt,
        leftAt: isLive ? null : updatedAt,
      }
    });

    // Add Customer Participant
    await prisma.participant.create({
      data: {
        sessionId: session.id,
        userId: selectedCustomer.id,
        joinedAt: new Date(createdAt.getTime() + 10000), // joined 10s later
        leftAt: isLive ? null : updatedAt,
      }
    });

    // Seed Events
    await prisma.event.createMany({
      data: [
        { sessionId: session.id, userId: selectedAgent.id, type: 'JOIN', timestamp: createdAt, payload: { name: selectedAgent.name } },
        { sessionId: session.id, userId: selectedCustomer.id, type: 'JOIN', timestamp: new Date(createdAt.getTime() + 10000), payload: { name: selectedCustomer.name } }
      ]
    });
    
    if (!isLive) {
      await prisma.event.create({
        data: { sessionId: session.id, type: 'END_SESSION', timestamp: updatedAt, payload: { reason: 'Resolved' } }
      });
    }

    // Add a random fake recording to 50% of sessions
    if (Math.random() > 0.5) {
      await prisma.recording.create({
        data: {
          sessionId: session.id,
          url: '/uploads/fake-recording.webm',
          createdAt: new Date(createdAt.getTime() + 30000)
        }
      });
    }

    // Add random fake messages
    if (Math.random() > 0.3) {
      await prisma.message.create({
        data: {
          sessionId: session.id,
          senderId: selectedCustomer.id,
          content: 'Here is a picture of the broken part.',
          fileUrl: '/uploads/fake-image.png',
          fileName: 'broken_part.png',
          fileType: 'image/png',
          timestamp: new Date(createdAt.getTime() + 60000)
        }
      });
    }
  }

  console.log('✅ Seed complete! DB is fully populated with analytics data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
