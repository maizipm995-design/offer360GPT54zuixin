import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type NormalizationAlias, type NormalizationTerm } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { clearAllJobsRecommendationCache } from '../jobs/jobs-recommendation-cache';
import { JOBS_NORMALIZATION_DOMAINS, type JobsNormalizationDomain } from '../jobs/jobs-normalization.types';
import {
  NORMALIZATION_LOCATION_LEVEL_SET,
  NORMALIZATION_LOCATION_LEVELS,
  NORMALIZATION_MATCH_MODES,
  NORMALIZATION_MATCH_MODE_SET,
  NORMALIZATION_RECORD_STATUSES,
  NORMALIZATION_STATUS_SET,
} from './admin-normalization.constants';
import {
  CreateLocationHierarchyDto,
  CreateNormalizationAliasDto,
  CreateNormalizationTermDto,
  ListLocationHierarchiesQueryDto,
  ListNormalizationAliasesQueryDto,
  ListNormalizationTermsQueryDto,
  UpdateLocationHierarchyDto,
  UpdateNormalizationAliasDto,
  UpdateNormalizationTermDto,
} from './dto/normalization.dto';
import { JobsNormalizationService } from '../jobs/jobs-normalization.service';

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

interface MutationOptions {
  skipCacheRefresh?: boolean;
}

type NormalizationStatus = (typeof NORMALIZATION_RECORD_STATUSES)[number];
type NormalizationLocationLevel = (typeof NORMALIZATION_LOCATION_LEVELS)[number];
type NormalizationMatchMode = (typeof NORMALIZATION_MATCH_MODES)[number];

type TermMutationInput = {
  domain: JobsNormalizationDomain;
  canonicalName: string;
  canonicalCode?: string | null;
  level?: NormalizationLocationLevel | null;
  status?: NormalizationStatus;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
};

type AliasMutationInput = {
  aliasName: string;
  matchMode?: NormalizationMatchMode;
  status?: NormalizationStatus;
  source?: string | null;
  sortOrder?: number;
};

type UpsertTermInput = TermMutationInput;

type UpsertAliasInput = AliasMutationInput & {
  domain: JobsNormalizationDomain;
  canonicalName: string;
};

type UpsertLocationHierarchyInput = {
  provinceCanonicalName: string;
  cityCanonicalName: string;
  status?: NormalizationStatus;
};

@Injectable()
export class AdminNormalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizationService: JobsNormalizationService,
  ) {}

  async getSummary() {
    const [termCount, aliasCount, locationHierarchyCount, latestTerm, latestAlias, latestHierarchy] = await Promise.all([
      this.prisma.normalizationTerm.count(),
      this.prisma.normalizationAlias.count(),
      this.prisma.locationHierarchy.count(),
      this.prisma.normalizationTerm.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.normalizationAlias.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.locationHierarchy.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);

    const latestUpdatedAt = [latestTerm?.updatedAt, latestAlias?.updatedAt, latestHierarchy?.updatedAt]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      termCount,
      aliasCount,
      locationHierarchyCount,
      updatedAt: latestUpdatedAt,
    };
  }

  async getTerms(query: ListNormalizationTermsQueryDto) {
    const pagination = this.getPagination(query);
    const where = this.buildTermsWhere(query);
    const [list, total] = await this.prisma.$transaction([
      this.prisma.normalizationTerm.findMany({
        where,
        include: {
          _count: {
            select: { aliases: true },
          },
        },
        orderBy: [{ domain: 'asc' }, { sortOrder: 'asc' }, { canonicalName: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.normalizationTerm.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toTermItem(item)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createTerm(dto: CreateNormalizationTermDto, options?: MutationOptions) {
    const data = await this.buildTermMutationData(dto);
    const created = await this.prisma.normalizationTerm.create({ data });
    await this.refreshCaches(options);
    return this.getTermById(created.id);
  }

  async updateTerm(id: string, dto: UpdateNormalizationTermDto, options?: MutationOptions) {
    const current = await this.ensureTermExists(id, true);
    if (dto.domain && dto.domain !== current.domain) {
      throw new BadRequestException('标准词域不支持直接修改，请删除后重新创建');
    }

    const data = await this.buildTermMutationData({
      domain: current.domain as JobsNormalizationDomain,
      canonicalName: dto.canonicalName ?? current.canonicalName,
      canonicalCode: this.hasOwnField(dto, 'canonicalCode') ? dto.canonicalCode ?? null : current.canonicalCode ?? undefined,
      level: (dto.level ?? current.level ?? undefined) as NormalizationLocationLevel | undefined,
      status: (dto.status ?? current.status) as NormalizationStatus,
      sortOrder: dto.sortOrder ?? current.sortOrder,
      metadata: this.hasOwnField(dto, 'metadata')
        ? (dto as { metadata?: Record<string, unknown> | null }).metadata ?? null
        : current.metadata as Record<string, unknown> | null,
    }, id);

    await this.prisma.normalizationTerm.update({ where: { id }, data });
    await this.refreshCaches(options);
    return this.getTermById(id);
  }

  async deleteTerm(id: string, options?: MutationOptions) {
    const current = await this.ensureTermExists(id, true);
    if (current._count.aliases > 0) {
      throw new BadRequestException('该标准词下仍存在别名，请先删除别名后再删除标准词');
    }
    if (current._count.locationAsProvince > 0 || current._count.locationAsCity > 0) {
      throw new BadRequestException('该地点词仍被省市关系引用，请先删除对应层级关系后再删除');
    }

    await this.prisma.normalizationTerm.delete({ where: { id } });
    await this.refreshCaches(options);
    return { deleted: true };
  }

  async getAliases(termId: string, query: ListNormalizationAliasesQueryDto) {
    const term = await this.ensureTermExists(termId);
    const pagination = this.getPagination(query, 50);
    const where = this.buildAliasesWhere(termId, query);
    const [list, total] = await this.prisma.$transaction([
      this.prisma.normalizationAlias.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { aliasName: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.normalizationAlias.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toAliasItem(item, term)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createAlias(termId: string, dto: CreateNormalizationAliasDto, options?: MutationOptions) {
    const term = await this.ensureTermExists(termId);
    const data = await this.buildAliasMutationData(term, dto);
    const created = await this.prisma.normalizationAlias.create({ data: { termId, ...data } });
    await this.refreshCaches(options);
    return this.toAliasItem(created, term);
  }

  async updateAlias(id: string, dto: UpdateNormalizationAliasDto, options?: MutationOptions) {
    const alias = await this.ensureAliasExists(id);
    const term = await this.ensureTermExists(alias.termId);
    const data = await this.buildAliasMutationData(term, {
      aliasName: dto.aliasName ?? alias.aliasName,
      matchMode: (dto.matchMode ?? alias.matchMode) as NormalizationMatchMode,
      status: (dto.status ?? alias.status) as NormalizationStatus,
      source: this.hasOwnField(dto, 'source') ? dto.source ?? null : alias.source ?? undefined,
      sortOrder: dto.sortOrder ?? alias.sortOrder,
    }, id);
    const updated = await this.prisma.normalizationAlias.update({ where: { id }, data });
    await this.refreshCaches(options);
    return this.toAliasItem(updated, term);
  }

  async deleteAlias(id: string, options?: MutationOptions) {
    await this.ensureAliasExists(id);
    await this.prisma.normalizationAlias.delete({ where: { id } });
    await this.refreshCaches(options);
    return { deleted: true };
  }

  async getLocationHierarchies(query: ListLocationHierarchiesQueryDto) {
    const pagination = this.getPagination(query);
    const where = this.buildLocationHierarchyWhere(query);
    const [list, total] = await this.prisma.$transaction([
      this.prisma.locationHierarchy.findMany({
        where,
        include: {
          provinceTerm: true,
          cityTerm: true,
        },
        orderBy: [
          { provinceTerm: { sortOrder: 'asc' } },
          { provinceTerm: { canonicalName: 'asc' } },
          { cityTerm: { canonicalName: 'asc' } },
        ],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.locationHierarchy.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toLocationHierarchyItem(item)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createLocationHierarchy(dto: CreateLocationHierarchyDto, options?: MutationOptions) {
    const payload = await this.buildLocationHierarchyMutationData(dto.provinceTermId, dto.cityTermId, dto.status);
    const created = await this.prisma.locationHierarchy.create({ data: payload });
    await this.refreshCaches(options);
    return this.getLocationHierarchyById(created.id);
  }

  async updateLocationHierarchy(id: string, dto: UpdateLocationHierarchyDto, options?: MutationOptions) {
    const current = await this.ensureLocationHierarchyExists(id);
    const payload = await this.buildLocationHierarchyMutationData(
      dto.provinceTermId ?? current.provinceTermId,
      dto.cityTermId ?? current.cityTermId,
      (dto.status ?? current.status) as NormalizationStatus,
      id,
    );
    await this.prisma.locationHierarchy.update({ where: { id }, data: payload });
    await this.refreshCaches(options);
    return this.getLocationHierarchyById(id);
  }

  async deleteLocationHierarchy(id: string, options?: MutationOptions) {
    await this.ensureLocationHierarchyExists(id);
    await this.prisma.locationHierarchy.delete({ where: { id } });
    await this.refreshCaches(options);
    return { deleted: true };
  }

  async upsertTermByImport(input: UpsertTermInput, options?: MutationOptions) {
    const data = await this.buildTermMutationData({
      domain: input.domain,
      canonicalName: input.canonicalName,
      canonicalCode: input.canonicalCode ?? undefined,
      level: input.level ?? undefined,
      status: input.status,
      sortOrder: input.sortOrder,
      metadata: input.metadata ?? undefined,
    });
    const term = await this.prisma.normalizationTerm.upsert({
      where: {
        domain_canonicalName: {
          domain: input.domain,
          canonicalName: input.canonicalName.trim(),
        },
      },
      update: data,
      create: data,
    });
    await this.refreshCaches(options);
    return this.getTermById(term.id);
  }

  async upsertAliasByImport(input: UpsertAliasInput, options?: MutationOptions) {
    const term = await this.prisma.normalizationTerm.findUnique({
      where: {
        domain_canonicalName: {
          domain: input.domain,
          canonicalName: input.canonicalName.trim(),
        },
      },
    });
    if (!term) {
      throw new BadRequestException(`未找到标准词：${input.domain} / ${input.canonicalName}`);
    }

    const data = await this.buildAliasMutationData(term, {
      aliasName: input.aliasName,
      matchMode: input.matchMode,
      status: input.status,
      source: input.source ?? undefined,
      sortOrder: input.sortOrder,
    });
    const aliasNormalized = this.normalizationService.normalizeTextForMatch(input.aliasName);

    const alias = await this.prisma.normalizationAlias.upsert({
      where: {
        termId_aliasNormalized: {
          termId: term.id,
          aliasNormalized,
        },
      },
      update: data,
      create: {
        termId: term.id,
        ...data,
      },
    });
    await this.refreshCaches(options);
    return this.toAliasItem(alias, term);
  }

  async upsertLocationHierarchyByImport(input: UpsertLocationHierarchyInput, options?: MutationOptions) {
    const province = await this.findTermByDomainAndName('LOCATION', input.provinceCanonicalName);
    const city = await this.findTermByDomainAndName('LOCATION', input.cityCanonicalName);

    const payload = await this.buildLocationHierarchyMutationData(
      province.id,
      city.id,
      input.status,
    );

    const hierarchy = await this.prisma.locationHierarchy.upsert({
      where: { cityTermId: city.id },
      update: payload,
      create: payload,
    });
    await this.refreshCaches(options);
    return this.getLocationHierarchyById(hierarchy.id);
  }

  async refreshCaches(options?: MutationOptions) {
    if (options?.skipCacheRefresh) {
      return;
    }
    this.normalizationService.clearCache();
    clearAllJobsRecommendationCache();
  }

  private async buildTermMutationData(payload: TermMutationInput, currentId?: string) {
    const domain = payload.domain;
    if (!JOBS_NORMALIZATION_DOMAINS.includes(domain)) {
      throw new BadRequestException('词典域不正确');
    }

    const canonicalName = payload.canonicalName?.trim();
    if (!canonicalName) {
      throw new BadRequestException('标准词不能为空');
    }

    const status = payload.status ?? NORMALIZATION_RECORD_STATUSES[0];
    if (!NORMALIZATION_STATUS_SET.has(status)) {
      throw new BadRequestException('词条状态不正确');
    }

    const canonicalCode = this.normalizeOptionalString(payload.canonicalCode, 80);
    const normalizedCanonical = this.normalizationService.normalizeTextForMatch(canonicalName);

    let level: string | null = null;
    if (domain === 'LOCATION') {
      if (!payload.level || !NORMALIZATION_LOCATION_LEVEL_SET.has(payload.level)) {
        throw new BadRequestException('地点词条必须选择省份或城市层级');
      }
      level = payload.level;
    } else if (payload.level) {
      throw new BadRequestException('只有地点词条允许设置层级');
    }

    const duplicate = await this.prisma.normalizationTerm.findUnique({
      where: {
        domain_canonicalName: {
          domain,
          canonicalName,
        },
      },
      include: {
        aliases: {
          where: { status: { in: [...NORMALIZATION_RECORD_STATUSES] } },
          select: { aliasNormalized: true },
        },
      },
    });
    if (duplicate && duplicate.id !== currentId) {
      throw new BadRequestException('同一词典域下已存在相同标准词');
    }

    if (currentId) {
      const existingAliases = duplicate?.aliases ?? (await this.prisma.normalizationAlias.findMany({
        where: { termId: currentId },
        select: { aliasNormalized: true },
      }));
      if (existingAliases.some((item) => item.aliasNormalized === normalizedCanonical)) {
        throw new BadRequestException('标准词不能与自身别名重复，请先调整别名后再保存');
      }
    }

    const metadata = (payload as { metadata?: Record<string, unknown> | null }).metadata;

    return {
      domain,
      canonicalName,
      canonicalCode,
      level,
      status,
      sortOrder: Number.isFinite(payload.sortOrder) ? Math.trunc(payload.sortOrder as number) : 0,
      ...(metadata === undefined
        ? {}
        : { metadata: metadata === null ? Prisma.JsonNull : metadata as Prisma.InputJsonValue }),
    } satisfies Prisma.NormalizationTermUncheckedCreateInput;
  }

  private async buildAliasMutationData(term: NormalizationTerm, payload: AliasMutationInput, currentId?: string) {
    const aliasName = payload.aliasName?.trim();
    if (!aliasName) {
      throw new BadRequestException('别名不能为空');
    }

    const aliasNormalized = this.normalizationService.normalizeTextForMatch(aliasName);
    if (!aliasNormalized) {
      throw new BadRequestException('别名不能为空');
    }

    const canonicalNormalized = this.normalizationService.normalizeTextForMatch(term.canonicalName);
    if (aliasNormalized === canonicalNormalized) {
      throw new BadRequestException('别名无需与标准词重复');
    }

    const status = payload.status ?? NORMALIZATION_RECORD_STATUSES[0];
    if (!NORMALIZATION_STATUS_SET.has(status)) {
      throw new BadRequestException('别名状态不正确');
    }

    const matchMode = payload.matchMode ?? 'exact';
    if (!NORMALIZATION_MATCH_MODE_SET.has(matchMode)) {
      throw new BadRequestException('匹配方式不正确');
    }

    const duplicate = await this.prisma.normalizationAlias.findUnique({
      where: {
        termId_aliasNormalized: {
          termId: term.id,
          aliasNormalized,
        },
      },
    });
    if (duplicate && duplicate.id !== currentId) {
      throw new BadRequestException('该别名已存在，无需重复添加');
    }

    return {
      aliasName,
      aliasNormalized,
      matchMode,
      status,
      source: this.normalizeOptionalString(payload.source, 30),
      sortOrder: Number.isFinite(payload.sortOrder) ? Math.trunc(payload.sortOrder as number) : 0,
    } satisfies Omit<Prisma.NormalizationAliasUncheckedCreateInput, 'termId'>;
  }

  private async buildLocationHierarchyMutationData(
    provinceTermId: string,
    cityTermId: string,
    status?: NormalizationStatus,
    currentId?: string,
  ) {
    const [provinceTerm, cityTerm] = await Promise.all([
      this.ensureTermExists(provinceTermId),
      this.ensureTermExists(cityTermId),
    ]);

    if (provinceTerm.domain !== 'LOCATION' || provinceTerm.level !== 'province') {
      throw new BadRequestException('父级节点必须是 LOCATION 域下的省份词条');
    }
    if (cityTerm.domain !== 'LOCATION' || cityTerm.level !== 'city') {
      throw new BadRequestException('子级节点必须是 LOCATION 域下的城市词条');
    }
    if (provinceTerm.status !== 'active' || cityTerm.status !== 'active') {
      throw new BadRequestException('省份和城市词条都必须处于启用状态后才能建立关系');
    }
    if (provinceTerm.id === cityTerm.id) {
      throw new BadRequestException('省份与城市不能选择同一词条');
    }

    const nextStatus: NormalizationStatus = status ?? NORMALIZATION_RECORD_STATUSES[0];
    if (!NORMALIZATION_STATUS_SET.has(nextStatus)) {
      throw new BadRequestException('省市关系状态不正确');
    }

    const duplicate = await this.prisma.locationHierarchy.findUnique({ where: { cityTermId } });
    if (duplicate && duplicate.id !== currentId) {
      throw new BadRequestException('该城市已绑定父级省份，请先编辑原有关系');
    }

    return {
      provinceTermId,
      cityTermId,
      status: nextStatus,
    } satisfies Prisma.LocationHierarchyUncheckedCreateInput;
  }

  private buildTermsWhere(query: ListNormalizationTermsQueryDto): Prisma.NormalizationTermWhereInput {
    const and: Prisma.NormalizationTermWhereInput[] = [];
    if (query.domain) {
      and.push({ domain: query.domain });
    }
    if (query.status) {
      and.push({ status: query.status });
    }
    const keyword = query.keyword?.trim();
    if (keyword) {
      and.push({
        OR: [
          { canonicalName: { contains: keyword } },
          { canonicalCode: { contains: keyword } },
          { aliases: { some: { aliasName: { contains: keyword } } } },
        ],
      });
    }
    return and.length ? { AND: and } : {};
  }

  private buildAliasesWhere(termId: string, query: ListNormalizationAliasesQueryDto): Prisma.NormalizationAliasWhereInput {
    const and: Prisma.NormalizationAliasWhereInput[] = [{ termId }];
    if (query.status) {
      and.push({ status: query.status });
    }
    const keyword = query.keyword?.trim();
    if (keyword) {
      and.push({ aliasName: { contains: keyword } });
    }
    return { AND: and };
  }

  private buildLocationHierarchyWhere(query: ListLocationHierarchiesQueryDto): Prisma.LocationHierarchyWhereInput {
    const and: Prisma.LocationHierarchyWhereInput[] = [];
    if (query.provinceTermId) {
      and.push({ provinceTermId: query.provinceTermId });
    }
    if (query.status) {
      and.push({ status: query.status });
    }
    const keyword = query.keyword?.trim();
    if (keyword) {
      and.push({
        OR: [
          { provinceTerm: { canonicalName: { contains: keyword } } },
          { cityTerm: { canonicalName: { contains: keyword } } },
        ],
      });
    }
    return and.length ? { AND: and } : {};
  }

  private async getTermById(id: string) {
    const term = await this.prisma.normalizationTerm.findUnique({
      where: { id },
      include: { _count: { select: { aliases: true } } },
    });
    if (!term) {
      throw new NotFoundException('标准词不存在');
    }
    return this.toTermItem(term);
  }

  private async getLocationHierarchyById(id: string) {
    const hierarchy = await this.prisma.locationHierarchy.findUnique({
      where: { id },
      include: { provinceTerm: true, cityTerm: true },
    });
    if (!hierarchy) {
      throw new NotFoundException('省市关系不存在');
    }
    return this.toLocationHierarchyItem(hierarchy);
  }

  private async ensureTermExists(id: string, withRelationCount = false) {
    const term = await this.prisma.normalizationTerm.findUnique({
      where: { id },
      include: withRelationCount
        ? {
            _count: {
              select: {
                aliases: true,
                locationAsProvince: true,
                locationAsCity: true,
              },
            },
          }
        : undefined,
    });
    if (!term) {
      throw new NotFoundException('标准词不存在');
    }
    return term as typeof term & {
      _count: { aliases: number; locationAsProvince: number; locationAsCity: number };
    };
  }

  private async ensureAliasExists(id: string) {
    const alias = await this.prisma.normalizationAlias.findUnique({ where: { id } });
    if (!alias) {
      throw new NotFoundException('别名不存在');
    }
    return alias;
  }

  private async ensureLocationHierarchyExists(id: string) {
    const hierarchy = await this.prisma.locationHierarchy.findUnique({ where: { id } });
    if (!hierarchy) {
      throw new NotFoundException('省市关系不存在');
    }
    return hierarchy;
  }

  private async findTermByDomainAndName(domain: JobsNormalizationDomain, canonicalName: string) {
    const term = await this.prisma.normalizationTerm.findUnique({
      where: {
        domain_canonicalName: {
          domain,
          canonicalName: canonicalName.trim(),
        },
      },
    });
    if (!term) {
      throw new BadRequestException(`未找到标准词：${domain} / ${canonicalName}`);
    }
    return term;
  }

  private toTermItem(item: NormalizationTerm & { _count?: { aliases: number } }) {
    return {
      id: item.id,
      domain: item.domain,
      canonicalName: item.canonicalName,
      canonicalCode: item.canonicalCode,
      level: item.level,
      status: item.status,
      sortOrder: item.sortOrder,
      metadata: item.metadata,
      aliasCount: item._count?.aliases ?? 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toAliasItem(item: NormalizationAlias, term: NormalizationTerm) {
    return {
      id: item.id,
      termId: item.termId,
      termDomain: term.domain,
      termCanonicalName: term.canonicalName,
      aliasName: item.aliasName,
      aliasNormalized: item.aliasNormalized,
      matchMode: item.matchMode,
      status: item.status,
      source: item.source,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toLocationHierarchyItem(item: Prisma.LocationHierarchyGetPayload<{ include: { provinceTerm: true; cityTerm: true } }>) {
    return {
      id: item.id,
      provinceTermId: item.provinceTermId,
      provinceCanonicalName: item.provinceTerm.canonicalName,
      cityTermId: item.cityTermId,
      cityCanonicalName: item.cityTerm.canonicalName,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private hasOwnField(payload: object, field: string) {
    return Object.prototype.hasOwnProperty.call(payload, field);
  }

  private normalizeOptionalString(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
      return value === null || value === undefined ? null : String(value).trim().slice(0, maxLength) || null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : null;
  }

  private getPagination(query: { page?: number; limit?: number }, fallbackLimit = 10): PaginationInput {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || fallbackLimit, 1), 200);
    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private toPagination(total: number, pagination: PaginationInput) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      hasMore: pagination.page * pagination.limit < total,
    };
  }
}
