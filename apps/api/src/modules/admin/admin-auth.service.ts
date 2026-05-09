import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ADMIN_PERMISSION_CATALOG } from './admin-permissions';

type AdminWithRoles = Prisma.AdminUserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: {
          include: {
            permissions: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const account = dto.account.trim();
    const admin = await this.prisma.adminUser.findFirst({
      where: {
        OR: [{ username: account }, { phone: account }, { email: account }],
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('管理员账号或密码错误');
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('管理员账号或密码错误');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await this.jwtService.signAsync({
      sub: admin.id,
      username: admin.username,
      type: 'admin',
    });

    return this.me(admin.id, token);
  }

  async getBootstrapStatus() {
    await this.ensureBootstrapConfigTable(this.prisma);
    const [adminCount, config] = await Promise.all([
      this.prisma.adminUser.count(),
      this.readBootstrapConfig(this.prisma),
    ]);

    const registerEntryClosed = config?.registerEntryClosed ?? false;
    return {
      hasAdminAccounts: adminCount > 0,
      adminCount,
      registerEntryClosed,
      shouldShowRegister: adminCount < 1 && !registerEntryClosed,
    };
  }

  async bootstrapRegister(body: Record<string, unknown>) {
    const username = this.readRequiredString(body.username, '管理员账号不能为空');
    const password = this.readRequiredString(body.password, '管理员密码不能为空');
    const realName = this.readOptionalString(body.realName);
    const phone = this.readOptionalString(body.phone);
    const email = this.readOptionalString(body.email);

    if (password.length < 8) {
      throw new BadRequestException('管理员密码长度不能少于 8 位');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await this.ensureBootstrapConfigTable(tx);
      const [adminCount, config] = await Promise.all([
        tx.adminUser.count(),
        this.readBootstrapConfig(tx),
      ]);

      if (adminCount > 0 || config?.registerEntryClosed) {
        throw new BadRequestException('管理员初始化入口已关闭或系统中已存在管理员账号');
      }

      await this.ensureUniqueAdminFields(tx, { username, phone, email });
      const role = await this.ensureBootstrapSuperAdminRole(tx);
      const passwordHash = await bcrypt.hash(password, 10);

      return tx.adminUser.create({
        data: {
          username,
          passwordHash,
          realName: realName || undefined,
          phone: phone || undefined,
          email: email || undefined,
          status: 'active',
          remark: '系统初始化创建的首个管理员账号',
          userRoles: {
            create: [{ roleId: role.id }],
          },
        },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: true,
                },
              },
            },
          },
        },
      });
    });

    const token = await this.jwtService.signAsync({
      sub: created.id,
      username: created.username,
      type: 'admin',
    });

    return this.toSession(created, token);
  }

  async closeBootstrapEntry() {
    await this.ensureBootstrapConfigTable(this.prisma);
    await this.prisma.$executeRawUnsafe(
      "INSERT INTO admin_bootstrap_configs (id, register_entry_closed, created_at, updated_at) VALUES (1, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE register_entry_closed = VALUES(register_entry_closed), updated_at = NOW()",
    );
    return this.getBootstrapStatus();
  }

  async me(adminId: string, token?: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('后台登录状态已失效');
    }

    return this.toSession(admin, token);
  }

  private toSession(admin: AdminWithRoles, token?: string) {
    const activeRoles = admin.userRoles.map((item) => item.role).filter((role) => role.status === 'active');
    const roles = activeRoles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
    }));
    const permissions = Array.from(new Set(activeRoles.flatMap((role) => role.permissions.map((permission) => permission.permissionKey))));
    const roleCodes = roles.map((role) => role.code);

    return {
      ...(token ? { token } : {}),
      admin: {
        id: admin.id,
        username: admin.username,
        realName: admin.realName ?? '',
        phone: admin.phone,
        email: admin.email,
        status: admin.status,
        remark: admin.remark,
        lastLoginAt: admin.lastLoginAt,
        roles,
        roleCodes,
        permissions,
        isSuperAdmin: roleCodes.includes('super-admin'),
      },
    };
  }

  private async ensureUniqueAdminFields(
    tx: Prisma.TransactionClient,
    input: { username?: string; phone?: string; email?: string },
  ) {
    if (input.username) {
      const existing = await tx.adminUser.findUnique({ where: { username: input.username } });
      if (existing) {
        throw new BadRequestException('管理员账号已存在');
      }
    }
    if (input.phone) {
      const existing = await tx.adminUser.findUnique({ where: { phone: input.phone } });
      if (existing) {
        throw new BadRequestException('管理员手机号已存在');
      }
    }
    if (input.email) {
      const existing = await tx.adminUser.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new BadRequestException('管理员邮箱已存在');
      }
    }
  }

  private async ensureBootstrapSuperAdminRole(tx: Prisma.TransactionClient) {
    const role = await tx.adminRole.upsert({
      where: { code: 'super-admin' },
      update: {
        name: '超级管理员',
        description: '系统初始化超级管理员角色',
        status: 'active',
      },
      create: {
        code: 'super-admin',
        name: '超级管理员',
        description: '系统初始化超级管理员角色',
        status: 'active',
      },
    });

    await tx.adminRolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.adminRolePermission.createMany({
      data: ADMIN_PERMISSION_CATALOG.map((permission) => ({
        roleId: role.id,
        permissionKey: permission.key,
        permissionName: permission.name,
        permissionGroup: permission.group,
        permissionType: 'api',
      })),
    });

    return role;
  }

  private async ensureBootstrapConfigTable(client: Prisma.TransactionClient | PrismaService) {
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS admin_bootstrap_configs (
        id INT NOT NULL PRIMARY KEY,
        register_entry_closed TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }

  private async readBootstrapConfig(client: Prisma.TransactionClient | PrismaService) {
    const rows = await client.$queryRawUnsafe<Array<{ register_entry_closed: number | boolean }>>(
      'SELECT register_entry_closed FROM admin_bootstrap_configs WHERE id = 1 LIMIT 1',
    );
    const first = rows[0];
    return {
      registerEntryClosed: Boolean(first?.register_entry_closed),
    };
  }

  private readRequiredString(value: unknown, message: string) {
    const normalized = this.readOptionalString(value);
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private readOptionalString(value: unknown) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }
}
