import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addAntigravity() {
  const email = 'antigravity@deepmind.com';
  const name = 'Antigravity AI';
  
  // Check if already exists
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log('Antigravity AI already exists in the database:', existing);
  } else {
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: '+15550199',
        avatar_color: '#7C3AED',
        is_pro: 1,
        is_current_user: 0,
        created_at: BigInt(Date.now()),
      }
    });
    console.log('Successfully created Antigravity AI user:', {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      is_pro: newUser.is_pro
    });
  }
  
  await prisma.$disconnect();
}

addAntigravity().catch(err => {
  console.error('Failed to create Antigravity AI:', err);
  process.exit(1);
});
