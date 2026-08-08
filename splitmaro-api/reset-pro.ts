import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'i.dineshkumarruhela@gmail.com';
  console.log(`[Reset Pro] Searching for user: ${email}...`);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });

  if (!user) {
    console.log(`[Reset Pro] User ${email} not found in database.`);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      is_pro: 0,
      updated_at: BigInt(Date.now())
    }
  });

  const deletedPurchases = await prisma.purchase.deleteMany({
    where: { user_id: user.id }
  });

  console.log(`✅ Success! User "${user.name}" (${user.email}) Pro status reset to 0 (Free User). Deleted ${deletedPurchases.count} purchase records.`);
}

main()
  .catch((err) => console.error('[Reset Pro Error]:', err))
  .finally(() => prisma.$disconnect());
