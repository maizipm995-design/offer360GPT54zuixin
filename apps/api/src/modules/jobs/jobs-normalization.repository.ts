import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class JobsNormalizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  getActiveTerms() {
    return this.prisma.normalizationTerm.findMany({
      where: { status: 'active' },
      orderBy: [{ domain: 'asc' }, { sortOrder: 'asc' }, { canonicalName: 'asc' }],
      include: {
        aliases: {
          where: { status: 'active' },
          orderBy: [{ sortOrder: 'asc' }, { aliasName: 'asc' }],
        },
      },
    });
  }

  getActiveLocationHierarchies() {
    return this.prisma.locationHierarchy.findMany({
      where: {
        status: 'active',
        provinceTerm: { status: 'active' },
        cityTerm: { status: 'active' },
      },
      include: {
        provinceTerm: {
          select: { id: true, canonicalName: true },
        },
        cityTerm: {
          select: { id: true, canonicalName: true },
        },
      },
    });
  }
}
