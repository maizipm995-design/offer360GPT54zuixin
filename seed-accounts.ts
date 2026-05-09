import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const userPhone = '15311199668';
  const userPass = '123456abc';
  const adminUser = 'admin948006037';
  const adminPass = '1348955044Shy';

  // 1. Create or Update User
  const userHash = await bcrypt.hash(userPass, 10);
  let user = await prisma.user.findUnique({ where: { phone: userPhone } });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: userPhone,
        passwordHash: userHash,
        myInviteCode: `OF${userPhone.slice(-4)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        status: 'active',
      }
    });
    console.log(`Created new user with phone: ${userPhone}`);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: userHash }
    });
    console.log(`Updated existing user with phone: ${userPhone}`);
  }

  // 2. Set Membership to Super Member for 180 days
  const now = new Date();
  const endAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  
  const membership = await prisma.userMembership.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      memberLevel: 'super',
      startAt: now,
      endAt: endAt,
      remainingDays: 180,
      sourceType: 'manual',
      sourceRemark: 'Script initialization'
    },
    update: {
      memberLevel: 'super',
      endAt: endAt,
      remainingDays: 180
    }
  });
  console.log(`Set user membership to SUPER for 180 days. Ends at: ${endAt.toISOString()}`);

  // 3. Create or Update Admin
  const adminHash = await bcrypt.hash(adminPass, 10);
  let admin = await prisma.adminUser.findUnique({ where: { username: adminUser } });
  
  if (!admin) {
    admin = await prisma.adminUser.create({
      data: {
        username: adminUser,
        passwordHash: adminHash,
        status: 'active'
      }
    });
    console.log(`Created new admin with username: ${adminUser}`);
  } else {
    admin = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: adminHash }
    });
    console.log(`Updated existing admin with username: ${adminUser}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });