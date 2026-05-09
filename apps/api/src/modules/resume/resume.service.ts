import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import type { Browser } from 'puppeteer-core';
import { env } from '../../config/env';
import { getUserMemberAccess, type MemberRoleCode } from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateResumeDraftDto } from './dto/create-resume-draft.dto';
import {
  DEFAULT_RESUME_STYLE_JSON,
  getResumeTemplateConfigsBundle,
  normalizeResumeStyleJson,
  type ResumeVerticalSpacingConfig,
} from './resume-template-config';
import { UpdateResumeDraftDto } from './dto/update-resume-draft.dto';

interface ResumePrintTokenPayload {
  purpose: 'resume-print';
  userId: string;
  resumeId: string;
}

interface LayoutMetrics {
  availableHeight: number;
  contentHeight: number;
  overflowHeight: number;
  pageCount: number;
}

@Injectable()
export class ResumeService implements OnModuleDestroy {
  private browserPromise: Promise<Browser> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly storageService: StorageService,
  ) {}

  async onModuleDestroy() {
    if (!this.browserPromise) {
      return;
    }

    const browser = await this.browserPromise.catch(() => null);
    this.browserPromise = null;
    await browser?.close().catch(() => undefined);
  }

  async getList(userId: string) {
    const [access, list, user, templateBundle] = await Promise.all([
      getUserMemberAccess(this.prisma, userId),
      this.prisma.resumeDraft.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { resumePdfExportCount: true },
      }),
      getResumeTemplateConfigsBundle(this.prisma),
    ]);
    const pdfDownloadLimit = this.getPdfDownloadLimit(access.memberRoleCode);
    const pdfDownloadCount = user?.resumePdfExportCount ?? 0;

    return {
      limit: this.getDraftLimit(access.memberRoleCode),
      total: list.length,
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      pdfDownloadCount,
      pdfDownloadLimit,
      pdfDownloadLimitReached: pdfDownloadLimit !== null && pdfDownloadCount >= pdfDownloadLimit,
      list: list.map((item) => this.normalizeDraft(item, templateBundle.globalVerticalSpacing)),
    };
  }

  async create(userId: string, dto: CreateResumeDraftDto) {
    const access = await getUserMemberAccess(this.prisma, userId);
    const limit = this.getDraftLimit(access.memberRoleCode);
    const count = await this.prisma.resumeDraft.count({ where: { userId } });
    if (count >= limit) {
      throw new BadRequestException(`当前账号最多创建 ${limit} 份简历，请先删除旧简历后再新建`);
    }
    const { globalVerticalSpacing } = await getResumeTemplateConfigsBundle(this.prisma);

    const draft = await this.prisma.resumeDraft.create({
      data: {
        userId,
        title: this.buildDraftTitle(dto.title, count),
        templateCode: DEFAULT_RESUME_STYLE_JSON.templateCode,
        status: 'draft',
        contentJson: {},
        styleJson: this.toPrismaJson(normalizeResumeStyleJson(undefined, { globalVerticalSpacing })),
        layoutJson: {},
      },
    });

    return this.hydrateDraftAssets(this.normalizeDraft(draft, globalVerticalSpacing));
  }

  async getDetail(userId: string, id: string) {
    const draft = await this.ensureOwnedDraft(userId, id);
    const { globalVerticalSpacing } = await getResumeTemplateConfigsBundle(this.prisma);
    return this.hydrateDraftAssets(this.normalizeDraft(draft, globalVerticalSpacing));
  }

  async getTemplateConfigs() {
    const { templates, globalVerticalSpacing } = await getResumeTemplateConfigsBundle(this.prisma);
    return templates.map((item) => ({
      ...item,
      styleJson: normalizeResumeStyleJson(item.styleJson, {
        globalVerticalSpacing,
        ignoreSourceVerticalSpacing: true,
      }),
    }));
  }

  async update(userId: string, id: string, dto: UpdateResumeDraftDto) {
    await this.ensureOwnedDraft(userId, id);
    const { globalVerticalSpacing } = await getResumeTemplateConfigsBundle(this.prisma);

    const updatedDraft = await this.prisma.resumeDraft.update({
      where: { id },
      data: {
        title: dto.title?.trim() || undefined,
        contentJson: this.toPrismaJson(this.sanitizeDraftContentForStorage(dto.contentJson)),
        styleJson: this.toPrismaJson(
          dto.styleJson === undefined
            ? undefined
            : normalizeResumeStyleJson(dto.styleJson, {
                globalVerticalSpacing,
                ignoreLegacyLineHeight: true,
              }),
        ),
        layoutJson: this.toPrismaJson(dto.layoutJson),
        lastValidatedAt: null,
      },
    });

    return this.hydrateDraftAssets(this.normalizeDraft(updatedDraft, globalVerticalSpacing));
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnedDraft(userId, id);
    await this.prisma.resumeDraft.delete({ where: { id } });
    return { success: true };
  }

  async validateLayout(userId: string, id: string) {
    const draft = await this.ensureOwnedDraft(userId, id);
    const metrics = await this.collectLayoutMetrics(userId, draft.id);

    await this.prisma.resumeDraft.update({
      where: { id: draft.id },
      data: { lastValidatedAt: new Date() },
    });

    return {
      isOverflow: metrics.overflowHeight > 0,
      pageCount: metrics.pageCount,
      availableHeight: metrics.availableHeight,
      contentHeight: metrics.contentHeight,
      overflowHeight: metrics.overflowHeight,
      hintMessage: metrics.overflowHeight > 0
        ? '内容超出单页，请尝试智能排版或精简较长经历后再导出'
        : '当前排版已满足单页导出要求',
    };
  }

  async exportPdf(userId: string, id: string) {
    const draft = await this.ensureOwnedDraft(userId, id);
    const access = await getUserMemberAccess(this.prisma, userId);
    const pdfDownloadLimit = this.getPdfDownloadLimit(access.memberRoleCode);

    if (pdfDownloadLimit !== null) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { resumePdfExportCount: true },
      });
      const pdfDownloadCount = user?.resumePdfExportCount ?? 0;
      if (pdfDownloadCount >= pdfDownloadLimit) {
        throw new BadRequestException(this.buildPdfDownloadUpgradeMessage());
      }
    }

    const printUrl = await this.buildPrintUrl(userId, draft.id);
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 20_000 });
      await page.waitForFunction('window.__RESUME_PRINT_READY__ === true', { timeout: 20_000 });
      await page.emulateMediaType('screen');
      const pdfBuffer = await page.pdf({
        printBackground: true,
        format: 'A4',
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      if (pdfDownloadLimit !== null) {
        const updated = await this.prisma.user.updateMany({
          where: {
            id: userId,
            resumePdfExportCount: {
              lt: pdfDownloadLimit,
            },
          },
          data: {
            resumePdfExportCount: {
              increment: 1,
            },
          },
        });

        if (!updated.count) {
          throw new BadRequestException(this.buildPdfDownloadUpgradeMessage());
        }
      }

      const filename = `${this.normalizeFilename(draft.title)}.pdf`;
      const uploaded = await this.storageService.uploadBuffer({
        pathSegments: ['resume'],
        actorType: 'user',
        actorId: userId,
        bizId: draft.id,
        fileName: filename,
        contentType: 'application/pdf',
        buffer: Buffer.from(pdfBuffer),
      });
      const downloadUrl = await this.storageService.createSignedDownloadUrl(uploaded.objectKey, filename, 'application/pdf');

      return {
        filename,
        mimeType: 'application/pdf',
        objectKey: uploaded.objectKey,
        downloadUrl,
        expiresAt: new Date(Date.now() + Math.max(60, env.ossSignExpireSeconds) * 1000).toISOString(),
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async getPrintPayload(id: string, token: string) {
    const payload = await this.verifyPrintToken(token);
    if (payload.resumeId !== id) {
      throw new UnauthorizedException('打印授权已失效，请重新导出');
    }

    const draft = await this.ensureOwnedDraft(payload.userId, id);
    const { globalVerticalSpacing } = await getResumeTemplateConfigsBundle(this.prisma);
    return this.hydrateDraftAssets(this.normalizeDraft(draft, globalVerticalSpacing));
  }

  private async ensureOwnedDraft(userId: string, id: string) {
    const draft = await this.prisma.resumeDraft.findFirst({
      where: { id, userId },
    });

    if (!draft) {
      throw new NotFoundException('简历不存在或无权访问');
    }

    return draft;
  }

  private getDraftLimit(roleCode: MemberRoleCode) {
    return roleCode === 'SUPER_MEMBER' ? 5 : 1;
  }

  private getPdfDownloadLimit(roleCode: MemberRoleCode) {
    return roleCode === 'SUPER_MEMBER' ? null : 1;
  }

  private buildPdfDownloadUpgradeMessage() {
    return '普通用户和标准会员仅支持下载 1 次简历，请开通超级会员继续下载';
  }

  private buildDraftTitle(title: string | undefined, count: number) {
    const normalized = title?.trim();
    if (normalized) {
      return normalized;
    }
    return count === 0 ? '我的简历' : `我的简历 ${count + 1}`;
  }

  private normalizeFilename(title: string) {
    return title.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) || 'resume';
  }

  private async buildPrintUrl(userId: string, resumeId: string) {
    const printToken = await this.jwtService.signAsync(
      {
        purpose: 'resume-print',
        userId,
        resumeId,
      } satisfies ResumePrintTokenPayload,
      { expiresIn: '10m' },
    );

    const url = new URL(`/resume-optimizer/print/${resumeId}`, env.webAppBaseUrl);
    url.searchParams.set('printToken', printToken);
    return url.toString();
  }

  private async verifyPrintToken(token: string) {
    if (!token) {
      throw new UnauthorizedException('缺少打印授权，请重新导出');
    }

    try {
      const payload = await this.jwtService.verifyAsync<ResumePrintTokenPayload>(token);
      if (payload.purpose !== 'resume-print' || !payload.userId || !payload.resumeId) {
        throw new UnauthorizedException('打印授权无效，请重新导出');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('打印授权已过期，请重新导出');
    }
  }

  private async collectLayoutMetrics(userId: string, resumeId: string) {
    const printUrl = await this.buildPrintUrl(userId, resumeId);
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 20_000 });
      await page.waitForFunction('window.__RESUME_PRINT_READY__ === true', { timeout: 20_000 });
      const metrics = await page.evaluate(() => (window as Window & { __RESUME_PRINT_METRICS__?: LayoutMetrics }).__RESUME_PRINT_METRICS__ ?? null);

      if (!metrics) {
        throw new BadRequestException('当前简历打印页尚未准备完成，请稍后重试');
      }

      return metrics;
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async getBrowser() {
    if (!this.browserPromise) {
      this.browserPromise = this.launchBrowser();
    }
    return this.browserPromise;
  }

  private async launchBrowser() {
    const puppeteer = await import('puppeteer-core');
    const executablePath = this.resolveExecutablePath();
    return puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium'],
    });
  }

  private resolveExecutablePath() {
    const candidates = [
      env.puppeteerExecutablePath,
      process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
    ].filter(Boolean);

    return candidates[0];
  }

  private toPrismaJson(value: unknown): InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }
    return value as InputJsonValue;
  }

  private normalizeDraft<T extends { styleJson?: unknown; templateCode: string }>(
    draft: T,
    globalVerticalSpacing: ResumeVerticalSpacingConfig,
  ) {
    const styleJson = normalizeResumeStyleJson(draft.styleJson, {
      globalVerticalSpacing,
      ignoreLegacyLineHeight: true,
    });
    return {
      ...draft,
      templateCode: styleJson.templateCode,
      styleJson,
    };
  }

  private async hydrateDraftAssets<T extends { contentJson?: unknown }>(draft: T) {
    return {
      ...draft,
      contentJson: await this.hydrateContentJsonAssets(draft.contentJson),
    };
  }

  private async hydrateContentJsonAssets(contentJson: unknown) {
    if (!this.isRecord(contentJson)) {
      return contentJson;
    }

    const content = { ...contentJson };
    const personal = this.isRecord(content.personal) ? { ...content.personal } : null;
    const educationSource = Array.isArray(content.education) ? content.education : [];

    if (personal) {
      const avatarValue = typeof personal.avatarUrl === 'string' ? personal.avatarUrl.trim() : '';
      personal.avatarPreviewUrl = await this.storageService.resolveAssetAccessUrl(avatarValue);
      content.personal = personal;
    }

    content.education = await Promise.all(
      educationSource.map(async (entry) => {
        if (!this.isRecord(entry)) {
          return entry;
        }

        const nextEntry = { ...entry };
        const logoValue = typeof nextEntry.logoUrl === 'string' ? nextEntry.logoUrl.trim() : '';
        nextEntry.logoPreviewUrl = await this.storageService.resolveAssetAccessUrl(logoValue);
        return nextEntry;
      }),
    );

    return content;
  }

  private sanitizeDraftContentForStorage(contentJson: unknown) {
    if (!this.isRecord(contentJson)) {
      return contentJson;
    }

    const content = { ...contentJson };
    if (this.isRecord(content.personal)) {
      const personal = { ...content.personal };
      delete personal.avatarPreviewUrl;
      content.personal = personal;
    }

    if (Array.isArray(content.education)) {
      content.education = content.education.map((entry) => {
        if (!this.isRecord(entry)) {
          return entry;
        }
        const nextEntry = { ...entry };
        delete nextEntry.logoPreviewUrl;
        return nextEntry;
      });
    }

    return content;
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
