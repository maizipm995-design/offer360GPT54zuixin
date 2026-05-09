import { PrismaClient } from '@prisma/client';
// @ts-ignore
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const phone = '15311199668';
  
  // 1. 创建或更新用户
  const passwordHash = await bcrypt.hash('123456abc', 10);
  let user = await prisma.user.findUnique({ where: { phone } });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        status: 'active',
        myInviteCode: randomUUID().slice(0, 8).toUpperCase(),
        profile: {
          create: {
            name: '测试用户_1531',
          }
        }
      }
    });
    console.log(`Created user with phone: ${phone}`);
  } else {
    user = await prisma.user.update({
      where: { phone },
      data: { passwordHash }
    });
    console.log(`User with phone ${phone} already exists, password updated. Proceeding to update membership.`);
  }

  // 2. （可选）如果项目中有 memberRole 模型的话可以查找相关配置，目前通过 userMembership 处理
  /*
  const superMemberRole = await prisma.memberRole.findUnique({
    where: { code: 'SUPER_MEMBER' }
  });

  if (!superMemberRole) {
    throw new Error('SUPER_MEMBER role not found in the database. Please ensure seed data is present.');
  }
  */

  // 3. 设置半年的超级会员
  const now = new Date();
  const endAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180天后 (约半年)

  const membership = await prisma.userMembership.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      startAt: now,
      endAt: endAt,
      memberLevel: 'super_member',
      remainingDays: 180,
      sourceType: 'manual',
    },
    update: {
      startAt: now,
      endAt: endAt,
      memberLevel: 'super_member',
      remainingDays: 180,
      sourceType: 'manual',
    }
  });

  console.log(`Successfully granted Super Membership to user ${phone} until ${endAt.toISOString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
