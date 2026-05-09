import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../../config/env';
import { PrismaService } from '../../../prisma.service';
import { CurrentAdminPayload } from '../decorators/current-admin.decorator';

interface AdminJwtPayload {
  sub: string;
  username: string;
  type: 'admin';
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  async validate(payload: AdminJwtPayload): Promise<CurrentAdminPayload> {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('后台登录状态已失效');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
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
      throw new UnauthorizedException('管理员账号不存在或已停用');
    }

    const activeRoles = admin.userRoles.map((item) => item.role).filter((role) => role.status === 'active');
    const roleCodes = Array.from(new Set(activeRoles.map((role) => role.code)));
    const permissions = Array.from(new Set(activeRoles.flatMap((role) => role.permissions.map((permission) => permission.permissionKey))));

    return {
      adminId: admin.id,
      username: admin.username,
      realName: admin.realName ?? '',
      phone: admin.phone,
      email: admin.email,
      status: admin.status,
      roleCodes,
      permissions,
      isSuperAdmin: roleCodes.includes('super-admin'),
    };
  }
}
