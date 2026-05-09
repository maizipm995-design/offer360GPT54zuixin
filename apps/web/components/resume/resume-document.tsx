'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { normalizeRichTextValue } from './resume-rich-text';
import {
  buildSectionVisibilityMap,
  formatResumeDate,
  normalizeHeaderAlignForVariant,
  getResumeFontFamily,
  getSectionLabel,
  isAwardEntryEmpty,
  isCampusRoleEntryEmpty,
  isEducationEntryEmpty,
  isExperienceEntryEmpty,
  isLanguageEntryEmpty,
  isLinkEntryEmpty,
  isProjectEntryEmpty,
  isSectionEmpty,
  isSkillEntryEmpty,
  type ResumeContent,
  type ResumeLayoutItem,
  type ResumePreviewMetrics,
  type ResumeSectionId,
  type ResumeStyleConfig,
} from './resume-types';

declare global {
  interface Window {
    __RESUME_PRINT_READY__?: boolean;
    __RESUME_PRINT_METRICS__?: ResumePreviewMetrics | null;
  }
}

interface ResumeDocumentProps {
  content: ResumeContent;
  styleConfig: ResumeStyleConfig;
  layout: ResumeLayoutItem[];
  mode?: 'preview' | 'print';
  onSectionClick?: (sectionId: ResumeSectionId) => void;
  onMetricsChange?: (metrics: ResumePreviewMetrics) => void;
  activeSectionId?: ResumeSectionId;
  onActiveSectionPageChange?: (page: number) => void;
}

interface ResumeTypography {
  nameSizePt: number;
  nameLineHeightPt: number;
  titleSizePt: number;
  titleLineHeightPt: number;
  bodySizePt: number;
  bodyLineHeightPt: number;
  metaSizePt: number;
  metaLineHeightPt: number;
  sectionBadgeSizePt: number;
  sectionBadgeLineHeightPt: number;
}

const PAGE_WIDTH_MM = '210mm';
const PAGE_HEIGHT_MM = '297mm';
const PREVIEW_PAGE_GAP_PX = 24;
const PAGE_MEASURE_EPSILON_PX = 1;
const HEADER_SCHOOL_LOGO_FRAME_WIDTH_MM = 30;
const HEADER_SCHOOL_LOGO_FRAME_HEIGHT_MM = 18.54;
const HEADER_AVATAR_SIZE_MM = 24;
const HEADER_AVATAR_LARGE_SIZE_MM = 28;
const RESUME_BODY_TEXT_COLOR = '#333333';
const RESUME_PRIMARY_TEXT_COLOR = '#1a1a1a';
const RESUME_META_TEXT_COLOR = '#666666';
const RESUME_TITLE_FONT_WEIGHT = 600;
const RESUME_DIVIDER_THICKNESS_PX = 2;
const DEFAULT_AVATAR_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><rect width='160' height='160' fill='%23F3F6FB'/><circle cx='80' cy='62' r='28' fill='%23C5CFDE'/><rect x='36' y='102' width='88' height='38' rx='19' fill='%23D7DEE9'/><text x='80' y='148' text-anchor='middle' font-size='14' fill='%23808AA0'>上传头像</text></svg>";

export function ResumeDocument({
  content,
  styleConfig,
  layout,
  mode = 'preview',
  onSectionClick,
  onMetricsChange,
  activeSectionId,
  onActiveSectionPageChange,
}: ResumeDocumentProps) {
  const measureFlowRef = useRef<HTMLDivElement | null>(null);
  const measurePageRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<ResumePreviewMetrics>({
    availableHeight: 0,
    contentHeight: 0,
    overflowHeight: 0,
    pageCount: 1,
  });
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [activePage, setActivePage] = useState(1);

  const visibilityMap = useMemo(() => buildSectionVisibilityMap(layout), [layout]);
  const orderedSections = useMemo(
    () => layout.map((item) => item.id).filter((sectionId) => visibilityMap[sectionId] && !isSectionEmpty(sectionId, content)),
    [content, layout, visibilityMap],
  );
  const typography = useMemo(() => buildTypography(styleConfig), [styleConfig]);
  const sheetStyle = useMemo<CSSProperties>(
    () => {
      const spacing = buildVerticalSpacing(styleConfig);
      return {
        width: PAGE_WIDTH_MM,
        background: '#fff',
        backgroundImage: getPaperBackgroundImage(styleConfig.paperBackgroundVariant),
        backgroundPosition: getPaperBackgroundPosition(styleConfig.paperBackgroundPosition),
        backgroundRepeat: 'no-repeat',
        backgroundSize: getPaperBackgroundSize(styleConfig.paperBackgroundVariant),
        color: RESUME_BODY_TEXT_COLOR,
        fontFamily: getResumeFontFamily(styleConfig.fontFamily),
        fontSize: `${typography.bodySizePt}pt`,
        lineHeight: `${spacing.bodyTextLineHeightPt}pt`,
        '--resume-section-title-divider-gap': `${spacing.sectionTitleToDividerPt}pt`,
        '--resume-divider-entry-gap': `${spacing.dividerToEntryHeaderPt}pt`,
        '--resume-entry-body-gap': `${spacing.entryHeaderToBodyPt}pt`,
        '--resume-list-item-gap': `${spacing.listItemGapPt}pt`,
        '--resume-body-line-height': `${spacing.bodyTextLineHeightPt}pt`,
        '--resume-paragraph-gap': `${spacing.paragraphGapPt}pt`,
        '--resume-section-card-gap': `${spacing.sectionCardGapPt}pt`,
        '--resume-page-padding-top': `${spacing.pagePaddingTopPt}pt`,
        '--resume-page-padding-bottom': `${spacing.pagePaddingBottomPt}pt`,
        '--resume-header-padding-top': `${spacing.headerPaddingTopPt}pt`,
        '--resume-header-padding-bottom': `${spacing.headerPaddingBottomPt}pt`,
        '--resume-theme-soft': hexToRgba(styleConfig.themeColor, 0.1),
        '--resume-theme-faint': hexToRgba(styleConfig.themeColor, 0.16),
        '--resume-theme-border': hexToRgba(styleConfig.themeColor, 0.32),
      } as CSSProperties;
    },
    [styleConfig, typography.bodySizePt],
  );
  const pageStyle = useMemo<CSSProperties>(
    () => ({
      width: PAGE_WIDTH_MM,
      height: PAGE_HEIGHT_MM,
      pageBreakAfter: 'always',
      breakAfter: 'page',
    }),
    [],
  );

  const recomputeMetrics = useCallback(() => {
    const measureFlow = measureFlowRef.current;
    const measurePage = measurePageRef.current;
    if (!measureFlow || !measurePage) {
      return;
    }

    const nextPageHeight = measurePage.getBoundingClientRect().height || 0;
    const nextContentHeight = Math.max(measureFlow.scrollHeight, measureFlow.getBoundingClientRect().height);
    if (!nextPageHeight || !nextContentHeight) {
      return;
    }

    const rawOverflowHeight = Math.max(nextContentHeight - nextPageHeight, 0);
    const normalizedOverflowHeight = rawOverflowHeight <= PAGE_MEASURE_EPSILON_PX ? 0 : rawOverflowHeight;

    const nextMetrics = {
      availableHeight: nextPageHeight,
      contentHeight: nextContentHeight,
      overflowHeight: normalizedOverflowHeight,
      pageCount:
        normalizedOverflowHeight === 0
          ? 1
          : Math.max(1, Math.ceil((nextContentHeight - PAGE_MEASURE_EPSILON_PX) / nextPageHeight)),
    } satisfies ResumePreviewMetrics;

    setPageHeightPx(nextPageHeight);
    setMetrics(nextMetrics);
    onMetricsChange?.(nextMetrics);

    const nextActivePage = (() => {
      if (!activeSectionId) {
        return 1;
      }

      const sectionElement = measureFlow.querySelector(`[data-resume-section="${activeSectionId}"]`) as HTMLElement | null;
      if (!sectionElement) {
        return 1;
      }

      return Math.min(nextMetrics.pageCount, Math.max(1, Math.floor(sectionElement.offsetTop / nextPageHeight) + 1));
    })();

    setActivePage(nextActivePage);
    onActiveSectionPageChange?.(nextActivePage);

    if (mode === 'print' && typeof window !== 'undefined') {
      window.__RESUME_PRINT_METRICS__ = nextMetrics;
      window.__RESUME_PRINT_READY__ = true;
    }
  }, [activeSectionId, mode, onActiveSectionPageChange, onMetricsChange]);

  useEffect(() => {
    let cancelled = false;

    if (mode === 'print' && typeof window !== 'undefined') {
      window.__RESUME_PRINT_READY__ = false;
      window.__RESUME_PRINT_METRICS__ = null;
    }

    const run = async () => {
      const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (fontSet?.ready) {
        await fontSet.ready.catch(() => undefined);
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (cancelled) {
        return;
      }

      recomputeMetrics();
    };

    void run();

    return () => {
      cancelled = true;
      if (mode === 'print' && typeof window !== 'undefined') {
        window.__RESUME_PRINT_READY__ = false;
        window.__RESUME_PRINT_METRICS__ = null;
      }
    };
  }, [content, layout, mode, recomputeMetrics, styleConfig]);

  useEffect(() => {
    const measureFlow = measureFlowRef.current;
    const measurePage = measurePageRef.current;
    if (!measureFlow || !measurePage || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => recomputeMetrics());
    observer.observe(measureFlow);
    observer.observe(measurePage);
    return () => observer.disconnect();
  }, [recomputeMetrics]);

  const pageCount = Math.max(metrics.pageCount, 1);
  const pageIndexes = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div className={cn('flex flex-col', mode === 'preview' ? 'gap-6' : 'gap-0')}>
      <div className="pointer-events-none fixed left-[-99999px] top-0 z-[-1] opacity-0">
        <div ref={measurePageRef} style={{ width: PAGE_WIDTH_MM, height: PAGE_HEIGHT_MM }} data-resume-measure-page-frame />
        <div ref={measureFlowRef} style={sheetStyle} data-resume-measure-content>
          <ResumeFlow
            content={content}
            orderedSections={orderedSections}
            styleConfig={styleConfig}
            typography={typography}
            onSectionClick={onSectionClick}
          />
        </div>
      </div>

      {pageIndexes.map((pageNumber) => {
        const isLastPage = pageNumber === pageCount;
        return (
          <article
            key={pageNumber}
            data-resume-page
            data-resume-page-frame
            data-resume-page-index={pageNumber}
            className={cn(
              'relative overflow-hidden bg-white text-slate-900',
              mode === 'preview' ? 'rounded-[24px] shadow-[0_18px_54px_rgba(15,23,42,0.12)]' : 'rounded-none shadow-none',
              mode === 'preview' && activePage === pageNumber && 'ring-2',
            )}
            style={{
              ...pageStyle,
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              breakAfter: isLastPage ? 'auto' : 'page',
              marginBottom: mode === 'preview' && !isLastPage ? `${PREVIEW_PAGE_GAP_PX}px` : 0,
              boxShadow:
                mode === 'preview' && activePage === pageNumber
                  ? `0 18px 54px rgba(15,23,42,0.12), 0 0 0 2px ${hexToRgba(styleConfig.themeColor, 0.32)}`
                  : undefined,
            }}
          >
            {mode === 'preview' ? (
              <div
                className="pointer-events-none absolute right-4 top-4 z-20 rounded-full border bg-white/95 px-3 py-1 text-[11px] font-medium shadow-sm"
                style={{ borderColor: hexToRgba(styleConfig.themeColor, 0.28), color: styleConfig.themeColor }}
              >
                第 {pageNumber} 页 / 共 {pageCount} 页
              </div>
            ) : null}

            <div className="h-full w-full overflow-hidden">
              <div style={{ transform: `translateY(-${Math.max(0, pageHeightPx * (pageNumber - 1))}px)` }}>
                <div style={sheetStyle}>
                  <ResumeFlow
                    content={content}
                    orderedSections={orderedSections}
                    styleConfig={styleConfig}
                    typography={typography}
                    onSectionClick={onSectionClick}
                  />
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ResumeFlow({
  content,
  orderedSections,
  styleConfig,
  typography,
  onSectionClick,
}: {
  content: ResumeContent;
  orderedSections: ResumeSectionId[];
  styleConfig: ResumeStyleConfig;
  typography: ResumeTypography;
  onSectionClick?: (sectionId: ResumeSectionId) => void;
}) {
  const renderableEducation = useMemo(() => content.education.filter((item) => !isEducationEntryEmpty(item)), [content.education]);
  const renderableInternships = useMemo(() => content.internships.filter((item) => !isExperienceEntryEmpty(item)), [content.internships]);
  const renderableProjects = useMemo(() => content.projects.filter((item) => !isProjectEntryEmpty(item)), [content.projects]);
  const renderableSkills = useMemo(() => content.skills.filter((item) => !isSkillEntryEmpty(item)), [content.skills]);
  const renderableAwards = useMemo(() => content.awards.filter((item) => !isAwardEntryEmpty(item)), [content.awards]);
  const renderableLanguages = useMemo(() => content.languages.filter((item) => !isLanguageEntryEmpty(item)), [content.languages]);
  const renderableCampusRoles = useMemo(() => content.campusRoles.filter((item) => !isCampusRoleEntryEmpty(item)), [content.campusRoles]);
  const renderableLinks = useMemo(() => content.links.filter((item) => !isLinkEntryEmpty(item)), [content.links]);
  const primarySchoolLogo = renderableEducation.find((item) => (item.logoPreviewUrl || item.logoUrl).trim()) ?? null;
  const contentStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--resume-section-card-gap)',
    flex: 1,
  };

  return (
    <div
      style={{
        minHeight: PAGE_HEIGHT_MM,
        paddingTop: '5mm',
        paddingBottom: '5mm',
        paddingLeft: `${styleConfig.pageMargin}mm`,
        paddingRight: `${styleConfig.pageMargin}mm`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ResumeHeader
        key={styleConfig.headerVariant}
        content={content}
        primarySchoolLogo={primarySchoolLogo}
        styleConfig={styleConfig}
        typography={typography}
      />

      {orderedSections.length ? (
        <div style={contentStyle} data-resume-content>
          {orderedSections.map((sectionId) => {
            switch (sectionId) {
              case 'personal':
                return null;
              case 'education':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    {renderableEducation.map((item) => (
                      <div key={item.id} className="flex flex-col" style={{ gap: 'var(--resume-entry-body-gap)' }}>
                        <div className="flex items-start justify-between" style={{ gap: 'var(--resume-divider-entry-gap)' }}>
                          <div className="flex min-w-0 flex-col" style={{ gap: 'var(--resume-divider-entry-gap)' }}>
                            <p className="font-semibold" style={{ fontSize: `${typography.titleSizePt}pt`, lineHeight: `${typography.titleLineHeightPt}pt`, color: RESUME_PRIMARY_TEXT_COLOR }}>
                              {[item.schoolName, item.degree].filter(Boolean).join(' ｜ ')}
                            </p>
                            {item.major ? (
                              <p style={{ fontSize: `${typography.bodySizePt}pt`, color: RESUME_META_TEXT_COLOR }}>
                                {item.major}
                              </p>
                            ) : null}
                          </div>
                          {(item.startDate || item.endDate) ? (
                            <p className="shrink-0" style={{ fontSize: `${typography.metaSizePt}pt`, color: RESUME_META_TEXT_COLOR }}>
                              {formatRange(item.startDate, item.endDate, styleConfig.dateFormat)}
                            </p>
                          ) : null}
                        </div>
                        {renderRichTextBlock(item.description, styleConfig, typography, 'list')}
                      </div>
                    ))}
                  </SectionCard>
                );
              case 'internships':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    {renderableInternships.map((item) => renderExperienceItem(item, styleConfig, typography, onSectionClick, sectionId))}
                  </SectionCard>
                );
              case 'projects':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    {renderableProjects.map((item) => renderProjectItem(item, styleConfig, typography, onSectionClick, sectionId))}
                  </SectionCard>
                );
              case 'skills':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    <SkillList key={styleConfig.skillVariant} items={renderableSkills} styleConfig={styleConfig} typography={typography} />
                  </SectionCard>
                );
              case 'awards':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    <div className="flex flex-col" style={{ gap: 'var(--resume-item-gap)' }}>
                      {renderableAwards.map((item) => (
                        <div key={item.id} className="flex flex-col" style={{ gap: 'var(--resume-entry-body-gap)', fontSize: `${typography.bodySizePt}pt`, color: RESUME_BODY_TEXT_COLOR }}>
                          <div className="flex items-start justify-between" style={{ gap: 'var(--resume-divider-entry-gap)' }}>
                            <p className="font-semibold" style={{ fontSize: `${typography.titleSizePt}pt`, lineHeight: `${typography.titleLineHeightPt}pt`, color: RESUME_PRIMARY_TEXT_COLOR }}>
                              {[item.title, item.level].filter(Boolean).join(' ｜ ')}
                            </p>
                            {item.awardDate ? (
                              <p className="shrink-0" style={{ fontSize: `${typography.metaSizePt}pt`, color: RESUME_META_TEXT_COLOR }}>
                                {formatResumeDate(item.awardDate, styleConfig.dateFormat)}
                              </p>
                            ) : null}
                          </div>
                          {renderRichTextBlock(item.description, styleConfig, typography, 'paragraph')}
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                );
              case 'languages':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    <div className="flex flex-col" style={{ gap: 'var(--resume-item-gap)' }}>
                      {renderableLanguages.map((item) => (
                        <div key={item.id} className="flex flex-col" style={{ gap: 'var(--resume-entry-body-gap)', fontSize: `${typography.bodySizePt}pt`, color: RESUME_BODY_TEXT_COLOR }}>
                          <p className="font-semibold" style={{ fontSize: `${typography.titleSizePt}pt`, lineHeight: `${typography.titleLineHeightPt}pt`, color: RESUME_PRIMARY_TEXT_COLOR }}>
                            {[item.language, item.score].filter(Boolean).join(' ｜ ')}
                          </p>
                          {renderRichTextBlock(item.description, styleConfig, typography, 'paragraph')}
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                );
              case 'campusRoles':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    {renderableCampusRoles.map((item) => renderCampusRoleItem(item, styleConfig, typography, onSectionClick, sectionId))}
                  </SectionCard>
                );
              case 'selfEvaluation':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    {renderRichTextBlock(content.selfEvaluation, styleConfig, typography, 'paragraph')}
                  </SectionCard>
                );
              case 'links':
                return (
                  <SectionCard key={sectionId} sectionId={sectionId} styleConfig={styleConfig} typography={typography} onSectionClick={onSectionClick}>
                    <div className="flex flex-col" style={{ gap: 'var(--resume-item-gap)' }}>
                      {renderableLinks.map((item) => (
                        <div key={item.id} style={{ fontSize: `${typography.bodySizePt}pt`, color: RESUME_BODY_TEXT_COLOR }}>
                          {item.label ? (
                            <span className="font-semibold" style={{ fontSize: `${typography.titleSizePt}pt`, lineHeight: `${typography.titleLineHeightPt}pt`, color: RESUME_PRIMARY_TEXT_COLOR }}>
                              {item.label}：
                            </span>
                          ) : null}
                          <span>{item.url}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                );
              default:
                return null;
            }
          })}
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({
  sectionId,
  styleConfig,
  typography,
  onSectionClick,
  children,
}: {
  sectionId: ResumeSectionId;
  styleConfig: ResumeStyleConfig;
  typography: ResumeTypography;
  onSectionClick?: (sectionId: ResumeSectionId) => void;
  children: ReactNode;
}) {
  const titleVariant = styleConfig.sectionTitleVariant;
  return (
    <section
      data-resume-section={sectionId}
      className="flex flex-col"
      style={{ gap: 'var(--resume-section-card-gap)' }}
      onClick={() => onSectionClick?.(sectionId)}
      role={onSectionClick ? 'button' : undefined}
      tabIndex={onSectionClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onSectionClick) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSectionClick(sectionId);
        }
      }}
    >
      <SectionTitle key={titleVariant} title={getSectionLabel(sectionId)} variant={titleVariant} styleConfig={styleConfig} typography={typography} />
      <div className="flex flex-col" style={{ gap: 'var(--resume-section-card-gap)' }}>{children}</div>
    </section>
  );
}

function ResumeHeader({
  content,
  primarySchoolLogo,
  styleConfig,
  typography,
}: {
  content: ResumeContent;
  primarySchoolLogo: ResumeContent['education'][number] | null;
  styleConfig: ResumeStyleConfig;
  typography: ResumeTypography;
}) {
  const infoItems = buildHeaderInfoItems(content);
  const baseHeaderStyle: CSSProperties = {
    paddingTop: '2mm',
    paddingBottom: '2mm',
    marginBottom: '6pt',
  };
  const headerAlign = normalizeHeaderAlignForVariant(styleConfig.headerVariant, styleConfig.headerAlign);
  const avatarUrl = content.personal.avatarPreviewUrl || content.personal.avatarUrl;
  const hasLogo = Boolean((primarySchoolLogo?.logoPreviewUrl || primarySchoolLogo?.logoUrl || '').trim());
  const avatarPlacement =
    styleConfig.headerVariant === 'business' || styleConfig.headerVariant === 'work'
      ? 'center'
      : headerAlign === 'right'
        ? 'left'
        : 'right';
  const logoPlacement = avatarPlacement === 'left' ? 'right' : 'left';

  const summaryBlock = (inverse = false, compact = false) => {
    if (!content.personal.summary) {
      return null;
    }
    const summaryClassName = compact ? 'max-w-[92%]' : 'max-w-[90%]';

    return (
      <div className={summaryClassName} style={{ marginTop: '2pt', textAlign: 'left' }}>
        {renderRichTextBlock(
          content.personal.summary,
          styleConfig,
          typography,
          'paragraph',
          inverse ? 'text-white/90' : undefined,
        )}
      </div>
    );
  };

  const renderInfoBlock = ({
    inverse = false,
    compact = false,
    centerContainer = false,
  }: {
    inverse?: boolean;
    compact?: boolean;
    centerContainer?: boolean;
  }) => (
    <div className={cn('flex min-w-0', centerContainer ? 'justify-center' : 'justify-start')}>
      <div className="flex min-w-0 flex-col" style={{ gap: '2pt', textAlign: 'left' }}>
        <NameBlock name={content.personal.name} typography={typography} color={inverse ? '#fff' : RESUME_PRIMARY_TEXT_COLOR} />
        <BasicInfo
          items={infoItems}
          variant={styleConfig.basicInfoVariant}
          styleConfig={styleConfig}
          typography={typography}
          inverse={inverse}
          justifyClass="justify-start"
        />
        {summaryBlock(inverse, compact)}
      </div>
    </div>
  );

  const renderSideHeader = ({
    avatarShape,
    inverse = false,
    backgroundStyle,
    containerClassName = 'border-b',
    containerStyle,
  }: {
    avatarShape: 'circle' | 'square';
    inverse?: boolean;
    backgroundStyle?: CSSProperties;
    containerClassName?: string;
    containerStyle?: CSSProperties;
  }) => {
    const gridTemplateColumns =
      avatarPlacement === 'left'
        ? hasLogo
          ? `${HEADER_AVATAR_SIZE_MM}mm minmax(0, 1fr) ${HEADER_SCHOOL_LOGO_FRAME_WIDTH_MM}mm`
          : `${HEADER_AVATAR_SIZE_MM}mm minmax(0, 1fr)`
        : hasLogo
          ? `${HEADER_SCHOOL_LOGO_FRAME_WIDTH_MM}mm minmax(0, 1fr) ${HEADER_AVATAR_SIZE_MM}mm`
          : `minmax(0, 1fr) ${HEADER_AVATAR_SIZE_MM}mm`;

    const avatarNode = (
      <div className={cn('flex items-start', avatarPlacement === 'left' ? 'justify-start' : 'justify-end')}>
        <AvatarBlock avatarUrl={avatarUrl} shape={avatarShape} />
      </div>
    );
    const logoNode = hasLogo ? (
      <div className={cn('flex items-start', logoPlacement === 'left' ? 'justify-start' : 'justify-end')}>
        <SchoolLogoBlock logo={primarySchoolLogo} />
      </div>
    ) : null;

    return (
      <div
        className={cn('relative', containerClassName)}
        style={{
          ...baseHeaderStyle,
          ...backgroundStyle,
          ...containerStyle,
        }}
      >
        <div className="grid items-start" style={{ gridTemplateColumns, gap: '4pt' }}>
          {avatarPlacement === 'left' ? (
            <>
              {avatarNode}
              {renderInfoBlock({ inverse, compact: true })}
              {logoNode}
            </>
          ) : (
            <>
              {logoNode}
              {renderInfoBlock({ inverse, compact: true })}
              {avatarNode}
            </>
          )}
        </div>
      </div>
    );
  };

  if (styleConfig.headerVariant === 'highlight') {
    return renderSideHeader({
      avatarShape: 'square',
      inverse: true,
      containerClassName: 'relative overflow-hidden rounded-[8px]',
      backgroundStyle: {
        paddingLeft: '10pt',
        paddingRight: '10pt',
        background: `linear-gradient(90deg, ${styleConfig.themeColor}, ${hexToRgba(styleConfig.themeColor, 0.54)})`,
      },
    });
  }

  if (styleConfig.headerVariant === 'clear') {
    return renderSideHeader({
      avatarShape: 'circle',
      containerClassName: 'relative border-b',
      containerStyle: { borderColor: '#E6E6E6' },
    });
  }

  if (styleConfig.headerVariant === 'work') {
    return (
      <div className="relative overflow-hidden border-b text-center" style={{ ...baseHeaderStyle, borderColor: '#E6E6E6', paddingTop: '0pt', paddingBottom: '8.5pt' }}>
        <div className="absolute left-[-5%] top-0 w-[110%] rounded-b-[50%]" style={{ height: '18mm', backgroundColor: styleConfig.themeColor }} />
        {primarySchoolLogo ? (
          <div className="absolute left-0 top-0">
            <SchoolLogoBlock logo={primarySchoolLogo} />
          </div>
        ) : null}
        <div className="relative mx-auto flex justify-center" style={{ marginBottom: '2pt' }}>
          <AvatarBlock avatarUrl={avatarUrl} shape="circle" large />
        </div>
        {renderInfoBlock({ compact: false, centerContainer: true })}
      </div>
    );
  }

  if (styleConfig.headerVariant === 'formal') {
    return (
      <div className="relative border-b" style={{ ...baseHeaderStyle, borderColor: '#E6E6E6' }}>
        <div
          className="absolute left-0 top-0 w-full"
          style={{ height: `${RESUME_DIVIDER_THICKNESS_PX}px`, backgroundColor: styleConfig.themeColor }}
        />
        <div className="pt-[2pt]">
          {renderSideHeader({
            avatarShape: 'square',
            containerClassName: 'relative',
            containerStyle: {
              paddingTop: '0pt',
              paddingBottom: '0pt',
              marginBottom: 0,
            },
          })}
        </div>
      </div>
    );
  }

  if (styleConfig.headerVariant === 'basic') {
    return renderSideHeader({
      avatarShape: 'square',
      containerClassName: 'relative border-b',
      containerStyle: { borderColor: '#E6E6E6' },
    });
  }

  // fallback to 'business' (居中头像：保持原有上下留白)
  return (
    <div className="relative border-b text-center" style={{ ...baseHeaderStyle, borderColor: '#E6E6E6', paddingTop: '0pt', paddingBottom: '8.5pt' }}>
      {primarySchoolLogo ? (
        <div className="absolute left-0 top-0">
          <SchoolLogoBlock logo={primarySchoolLogo} />
        </div>
      ) : null}
      <div className="flex justify-center" style={{ marginBottom: '2pt' }}>
        <AvatarBlock avatarUrl={avatarUrl} shape="circle" large />
      </div>
      {renderInfoBlock({ compact: false, centerContainer: true })}
    </div>
  );
}

function SchoolLogoBlock({ logo }: { logo: ResumeContent['education'][number] | null }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const logoUrl = (logo?.logoPreviewUrl || logo?.logoUrl || '').trim();
  const canRenderImage = Boolean(logoUrl) && !loadFailed;

  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: `${HEADER_SCHOOL_LOGO_FRAME_WIDTH_MM}mm`,
        height: `${HEADER_SCHOOL_LOGO_FRAME_HEIGHT_MM}mm`,
        background: 'transparent',
      }}
    >
      {logoUrl ? (
        canRenderImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`${logo?.schoolName || '学校'}校徽`}
              className="block max-w-full object-contain"
              style={{ maxHeight: '100%', width: 'auto' }}
              onError={() => setLoadFailed(true)}
            />
          </>
        ) : null
      ) : null}
    </div>
  );
}

function AvatarBlock({ avatarUrl, shape, large = false }: { avatarUrl: string; shape: 'circle' | 'square'; large?: boolean }) {
  const size = large ? HEADER_AVATAR_LARGE_SIZE_MM : HEADER_AVATAR_SIZE_MM;
  const frameHeight = shape === 'square' ? Number((size * 413 / 295).toFixed(2)) : size;
  const [loadFailed, setLoadFailed] = useState(false);
  const normalizedAvatarUrl = avatarUrl.trim();
  const showFallback = !normalizedAvatarUrl || loadFailed;
  const displayUrl = showFallback ? DEFAULT_AVATAR_PLACEHOLDER : normalizedAvatarUrl;

  return (
    <div
      className={cn('shrink-0 overflow-hidden border bg-[#FAFAFA]', shape === 'circle' ? 'rounded-full' : 'rounded-[16px]')}
      style={{ width: `${size}mm`, height: `${frameHeight}mm`, borderColor: '#E8E8E8', boxShadow: '0 10px 24px rgba(15,23,42,0.08)' }}
    >
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayUrl}
          alt={showFallback ? '默认头像占位图' : '简历头像'}
          className={cn('h-full w-full', showFallback ? 'object-contain bg-[#F3F6FB] p-2' : 'object-cover')}
          style={{ objectPosition: shape === 'square' ? 'center top' : 'center' }}
          onError={() => setLoadFailed(true)}
        />
      </>
    </div>
  );
}

function NameBlock({ name, typography, color }: { name: string; typography: ResumeTypography; color: string }) {
  if (!name) {
    return null;
  }
  return (
    <h1
      className="block w-full tracking-[0.06em]"
      style={{
        fontSize: `${typography.nameSizePt}pt`,
        lineHeight: `${typography.nameLineHeightPt}pt`,
        color,
        fontWeight: RESUME_TITLE_FONT_WEIGHT,
      }}
    >
      {name}
    </h1>
  );
}

function buildHeaderInfoItems(content: ResumeContent) {
  return [
    { key: 'phone', label: '电话', value: content.personal.phone, icon: '☎' },
    { key: 'email', label: '邮箱', value: content.personal.email, icon: '✉' },
    { key: 'availability', label: '状态', value: content.personal.availability, icon: '◇' },
    { key: 'expectedRole', label: '意向', value: content.personal.expectedRole, icon: '◆' },
    { key: 'expectedCity', label: '城市', value: content.personal.expectedCity, icon: '⌖' },
    { key: 'website', label: '主页', value: content.personal.website, icon: '↗' },
  ].map((item) => ({ ...item, value: item.value.trim() })).filter((item) => item.value);
}

function BasicInfo({
  items,
  variant,
  styleConfig,
  typography,
  inverse = false,
  justifyClass = 'justify-center',
}: {
  items: Array<{ key: string; label: string; value: string; icon: string }>;
  variant: ResumeStyleConfig['basicInfoVariant'];
  styleConfig: ResumeStyleConfig;
  typography: ResumeTypography;
  inverse?: boolean;
  justifyClass?: string;
}) {
  if (!items.length) {
    return null;
  }
  const color = inverse ? 'rgba(255,255,255,0.92)' : RESUME_META_TEXT_COLOR;
  const accent = inverse ? '#fff' : styleConfig.themeColor;

  const firstLineCount = Math.floor(items.length / 2);
  const firstLineItems = items.slice(0, firstLineCount);
  const secondLineItems = items.slice(firstLineCount);

  const renderItems = (lineItems: typeof items) => {
    const isText = variant.startsWith('text');
    const isLine = variant.endsWith('line');

    return lineItems.map((item, index) => (
      <span key={item.key} className="inline-flex items-center">
        {index > 0 ? (
          isLine ? (
            <span className="mx-2.5 font-light opacity-40" style={{ color: accent }}>|</span>
          ) : (
            <span className="mx-2.5 h-1 w-1 shrink-0 rounded-full opacity-70" style={{ backgroundColor: accent }} />
          )
        ) : null}
        {isText ? (
          <span>{item.label}：{item.value}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span style={{ color: accent }}>{item.icon}</span>
            <span>{item.value}</span>
          </span>
        )}
      </span>
    ));
  };

  return (
    <div
      className={cn(
        'flex flex-col',
        justifyClass === 'justify-start' ? 'items-start' : justifyClass === 'justify-end' ? 'items-end' : 'items-center',
      )}
      style={{
        marginTop: '4pt',
        gap: '2pt',
        fontSize: `${typography.metaSizePt}pt`,
        color,
        lineHeight: `${typography.metaLineHeightPt}pt`,
      }}
    >
      {firstLineItems.length > 0 ? (
        <div className={cn('flex flex-wrap', justifyClass)}>
          {renderItems(firstLineItems)}
        </div>
      ) : null}
      {secondLineItems.length > 0 ? (
        <div className={cn('flex flex-wrap', justifyClass)}>
          {renderItems(secondLineItems)}
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({
  title,
  variant,
  styleConfig,
  typography,
}: {
  title: string;
  variant: ResumeStyleConfig['sectionTitleVariant'];
  styleConfig: ResumeStyleConfig;
  typography: ResumeTypography;
}) {
  const titleStyle: CSSProperties = {
    color: variant === 'pill-line' ? '#fff' : styleConfig.themeColor,
    fontSize: `${typography.sectionBadgeSizePt}pt`,
    lineHeight: `${typography.sectionBadgeLineHeightPt}pt`,
  };

  if (variant === 'pill-line') {
    return (
      <div className="flex items-center" style={{ gap: 'var(--resume-section-title-divider-gap)' }}>
        <div className="rounded-r-full px-4" style={{ paddingTop: '4pt', paddingBottom: '4pt', backgroundColor: styleConfig.themeColor }}>
          <h2 className="shrink-0 tracking-[0.08em]" style={{ ...titleStyle, fontWeight: RESUME_TITLE_FONT_WEIGHT }}>{title}</h2>
        </div>
        <div
          className="flex-1 rounded-full"
          style={{ height: `${RESUME_DIVIDER_THICKNESS_PX}px`, backgroundColor: styleConfig.themeColor }}
        />
      </div>
    );
  }

  if (variant === 'left-bar') {
    return (
      <div className="flex items-center border-b" style={{ paddingBottom: 'var(--resume-section-title-divider-gap)', gap: 'var(--resume-section-title-divider-gap)', borderColor: 'var(--resume-theme-border)' }}>
        <span
          className="shrink-0 rounded-sm"
          style={{ height: `${typography.sectionBadgeLineHeightPt}pt`, width: `${RESUME_DIVIDER_THICKNESS_PX}px`, backgroundColor: styleConfig.themeColor }}
        />
        <h2
          className="shrink-0 tracking-[0.08em]"
          style={{ ...titleStyle, color: styleConfig.themeColor, fontWeight: RESUME_TITLE_FONT_WEIGHT }}
        >
          {title}
        </h2>
      </div>
    );
  }

  if (variant === 'bg-block') {
    return (
      <div className="flex items-center rounded-[4px] px-3" style={{ paddingTop: '4pt', paddingBottom: '4pt', gap: 'var(--resume-section-title-divider-gap)', backgroundColor: 'var(--resume-theme-soft)' }}>
        <span
          className="shrink-0 rounded-sm"
          style={{ height: `${typography.sectionBadgeLineHeightPt}pt`, width: `${RESUME_DIVIDER_THICKNESS_PX}px`, backgroundColor: styleConfig.themeColor }}
        />
        <h2
          className="shrink-0 tracking-[0.08em]"
          style={{ ...titleStyle, color: styleConfig.themeColor, fontWeight: RESUME_TITLE_FONT_WEIGHT }}
        >
          {title}
        </h2>
      </div>
    );
  }

  // classic (bottom-line)
  return (
    <div className="flex flex-col" style={{ gap: 'var(--resume-section-title-divider-gap)' }}>
      <h2
        className="shrink-0 tracking-[0.08em]"
        style={{ ...titleStyle, color: styleConfig.themeColor, fontWeight: RESUME_TITLE_FONT_WEIGHT }}
      >
        {title}
      </h2>
      <div
        className="w-full"
        style={{ height: `${RESUME_DIVIDER_THICKNESS_PX}px`, backgroundColor: styleConfig.themeColor }}
      />
    </div>
  );
}

function SkillList({
  items,
  styleConfig,
  typography,
}: {
  items: ResumeContent['skills'];
  styleConfig: ResumeStyleConfig;
  typography: ResumeTypography;
}) {
  if (styleConfig.skillVariant === 'icon-grid') {
    return (
      <div className="grid grid-cols-2" style={{ gap: 'var(--resume-section-card-gap)' }}>
        {items.map((item) => (
          <div key={item.id} className="flex rounded-[6px] px-2" style={{ paddingTop: '4pt', paddingBottom: '4pt', gap: 'var(--resume-entry-body-gap)', backgroundColor: 'var(--resume-theme-soft)' }}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ marginTop: '3pt', backgroundColor: styleConfig.themeColor }} />
            <div className="min-w-0" style={{ fontSize: `${typography.bodySizePt}pt`, color: RESUME_BODY_TEXT_COLOR }}>
              {item.category ? <p className="font-semibold" style={{ color: RESUME_PRIMARY_TEXT_COLOR }}>{item.category}</p> : null}
              {renderRichTextBlock(item.content, styleConfig, typography, 'list', '[&_ul]:pl-4 [&_ol]:pl-4')}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (styleConfig.skillVariant === 'tag-list') {
    return (
      <div className="flex flex-wrap" style={{ gap: 'var(--resume-list-item-gap)' }}>
        {items.map((item) => {
          const text = [item.category, getPlainSkillText(item.content)].filter(Boolean).join('：');
          return text ? (
            <span key={item.id} className="rounded-full border px-2.5" style={{ paddingTop: '3pt', paddingBottom: '3pt', borderColor: 'var(--resume-theme-border)', color: RESUME_BODY_TEXT_COLOR, fontSize: `${typography.bodySizePt}pt` }}>
              {text}
            </span>
          ) : null;
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--resume-section-card-gap)' }}>
      {items.map((item) => (
        <div key={item.id} className="flex flex-col" style={{ gap: 'var(--resume-entry-body-gap)', fontSize: `${typography.bodySizePt}pt`, color: RESUME_BODY_TEXT_COLOR }}>
          {item.category ? <p className="font-semibold" style={{ fontSize: `${typography.titleSizePt}pt`, lineHeight: `${typography.titleLineHeightPt}pt`, color: RESUME_PRIMARY_TEXT_COLOR }}>{item.category}</p> : null}
          {renderRichTextBlock(item.content, styleConfig, typography, 'list')}
        </div>
      ))}
    </div>
  );
}

function getPlainSkillText(value: string) {
  return normalizeRichTextValue(value, 'paragraph')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderExperienceItem(
  item: ResumeContent['internships'][number],
  styleConfig: ResumeStyleConfig,
  typography: ResumeTypography,
  onSectionClick: ResumeDocumentProps['onSectionClick'],
  sectionId: ResumeSectionId,
) {
  if (!item.companyName && !item.roleName && !item.city && !item.startDate && !item.endDate && !item.description) {
    return null;
  }

  return (
    <div key={item.id} className="flex flex-col" style={{ gap: 'var(--resume-entry-body-gap)' }} onClick={() => onSectionClick?.(sectionId)}>
      <ExperienceHeader
        primary={item.companyName}
        secondary={item.roleName}
        city={item.city}
        startDate={item.startDate}
        endDate={item.endDate}
        styleConfig={styleConfig}
        typography={typography}
      />
      {renderRichTextBlock(item.description, styleConfig, typography, 'list')}
    </div>
  );
}

function renderProjectItem(
  item: ResumeContent['projects'][number],
  styleConfig: ResumeStyleConfig,
  typography: ResumeTypography,
  onSectionClick: ResumeDocumentProps['onSectionClick'],
  sectionId: ResumeSectionId,
) {
  if (isProjectEntryEmpty(item)) {
    return null;
  }

  return (
    <div key={item.id} className="flex flex-col" style={{ gap: 'var(--resume-entry-body-gap)' }} onClick={() => onSectionClick?.(sectionId)}>
      <ExperienceHeader
        primary={item.projectName}
        secondary={item.roleName}
        city={item.city}
        startDate={item.startDate}
        endDate={item.endDate}
        styleConfig={styleConfig}
        typography={typography}
      />
      {renderRichTextBlock(item.description, styleConfig, typography, 'list')}
    </div>
  );
}

function renderCampusRoleItem(
  item: ResumeContent['campusRoles'][number],
  styleConfig: ResumeStyleConfig,
  typography: ResumeTypography,
  onSectionClick: ResumeDocumentProps['onSectionClick'],
  sectionId: ResumeSectionId,
) {
  if (isCampusRoleEntryEmpty(item)) {
    return null;
  }

  return (
    <div key={item.id} className="flex flex-col" style={{ gap: 'var(--resume-entry-body-gap)' }} onClick={() => onSectionClick?.(sectionId)}>
      <ExperienceHeader
        primary={item.organization}
        secondary={item.roleName}
        city=""
        startDate={item.startDate}
        endDate={item.endDate}
        styleConfig={styleConfig}
        typography={typography}
      />
      {renderRichTextBlock(item.description, styleConfig, typography, 'list')}
    </div>
  );
}

function ExperienceHeader({
  primary,
  secondary,
  city,
  startDate,
  endDate,
  styleConfig,
  typography,
}: {
  primary: string;
  secondary: string;
  city: string;
  startDate: string;
  endDate: string;
  styleConfig: ResumeStyleConfig;
  typography: ResumeTypography;
}) {
  const timeText = formatRange(startDate, endDate, styleConfig.dateFormat);
  const locationText = city.trim();
  const firstLine = [timeText, primary].filter(Boolean);
  const secondLine = [secondary, locationText].filter(Boolean);

  if (styleConfig.titleStyle === 'double' || styleConfig.experienceHeaderVariant === 'double-line') {
    return (
      <div className="flex flex-col" style={{ gap: 'var(--resume-divider-entry-gap)' }}>
        {firstLine.length ? (
          <p className="font-semibold" style={{ fontSize: `${typography.titleSizePt}pt`, lineHeight: `${typography.titleLineHeightPt}pt`, color: RESUME_PRIMARY_TEXT_COLOR }}>
            {firstLine.join(' ｜ ')}
          </p>
        ) : null}
        {secondLine.length ? (
          <p style={{ fontSize: `${typography.metaSizePt}pt`, lineHeight: `${typography.metaLineHeightPt}pt`, color: RESUME_META_TEXT_COLOR }}>
            {secondLine.join(' ｜ ')}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between" style={{ gap: 'var(--resume-divider-entry-gap)' }}>
      <p className="min-w-0 font-semibold" style={{ fontSize: `${typography.titleSizePt}pt`, lineHeight: `${typography.titleLineHeightPt}pt`, color: RESUME_PRIMARY_TEXT_COLOR }}>
        {[timeText, primary, secondary, locationText].filter(Boolean).join(' ｜ ')}
      </p>
    </div>
  );
}

function renderRichTextBlock(
  value: string,
  _styleConfig: ResumeStyleConfig,
  typography: ResumeTypography,
  preset: 'paragraph' | 'list',
  className?: string,
) {
  const html = normalizeRichTextValue(value, preset);
  if (!html) {
    return null;
  }

  return (
    <div
      className={cn(
        '[&>*+*]:mt-[var(--resume-paragraph-gap)] [&_li+li]:mt-[var(--resume-list-item-gap)] [&_em]:italic [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:marker:text-[#909090] [&_p]:m-0 [&_strong]:font-semibold [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-[#909090]',
        className,
      )}
      style={{ fontSize: `${typography.bodySizePt}pt`, lineHeight: 'var(--resume-body-line-height)', color: RESUME_BODY_TEXT_COLOR }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function formatRange(startDate: string, endDate: string, format: ResumeStyleConfig['dateFormat']) {
  const startText = startDate ? formatResumeDate(startDate, format) : '';
  const endText = endDate ? formatResumeDate(endDate, format) : '';
  if (startText && endText) {
    return `${startText} - ${endText}`;
  }
  return startText || endText;
}
function buildVerticalSpacing(styleConfig: ResumeStyleConfig) {
  const scale = styleConfig.spacingScale ?? 1;
  const base = styleConfig.verticalSpacing;

  return {
    sectionTitleToDividerPt: base.sectionTitleToDividerPt * scale,
    dividerToEntryHeaderPt: base.dividerToEntryHeaderPt * scale,
    entryHeaderToBodyPt: base.entryHeaderToBodyPt * scale,
    listItemGapPt: base.listItemGapPt * scale,
    bodyTextLineHeightPt: base.bodyTextLineHeightPt * scale,
    paragraphGapPt: base.paragraphGapPt * scale,
    sectionCardGapPt: base.sectionCardGapPt * scale,
    pagePaddingTopPt: base.pagePaddingTopPt * scale,
    pagePaddingBottomPt: base.pagePaddingBottomPt * scale,
    headerPaddingTopPt: base.headerPaddingTopPt * scale,
    headerPaddingBottomPt: base.headerPaddingBottomPt * scale,
  };
}

function getPaperBackgroundImage(variant: ResumeStyleConfig['paperBackgroundVariant']) {
  switch (variant) {
    case 'diamond-grid':
      return [
        'linear-gradient(45deg, rgba(120,130,150,0.12) 1px, transparent 1px)',
        'linear-gradient(-45deg, rgba(120,130,150,0.12) 1px, transparent 1px)',
      ].join(',');
    case 'arc-lines':
      return 'repeating-radial-gradient(circle at 88% 14%, transparent 0 8px, rgba(120,130,150,0.12) 9px 10px)';
    case 'wave-lines':
      return [
        'radial-gradient(ellipse at 88% 12%, rgba(120,130,150,0.12) 0 1px, transparent 2px)',
        'repeating-radial-gradient(ellipse at 92% 10%, transparent 0 10px, rgba(120,130,150,0.11) 11px 12px)',
      ].join(',');
    case 'vertical-wave':
      return 'repeating-radial-gradient(ellipse at 36% 4%, transparent 0 9px, rgba(120,130,150,0.11) 10px 11px)';
    case 'petal':
      return [
        'radial-gradient(ellipse at 18% 18%, transparent 0 24px, rgba(120,130,150,0.11) 25px 26px, transparent 27px)',
        'radial-gradient(ellipse at 78% 42%, transparent 0 24px, rgba(120,130,150,0.11) 25px 26px, transparent 27px)',
      ].join(',');
    case 'chevron':
      return [
        'linear-gradient(135deg, transparent 47%, rgba(120,130,150,0.12) 48% 50%, transparent 51%)',
        'linear-gradient(45deg, transparent 47%, rgba(120,130,150,0.12) 48% 50%, transparent 51%)',
      ].join(',');
    case 'geo-frame':
      return [
        'linear-gradient(30deg, transparent 44%, rgba(120,130,150,0.11) 45% 47%, transparent 48%)',
        'linear-gradient(150deg, transparent 44%, rgba(120,130,150,0.11) 45% 47%, transparent 48%)',
      ].join(',');
    case 'angle-grid':
      return [
        'linear-gradient(60deg, transparent 48%, rgba(120,130,150,0.1) 49% 50%, transparent 51%)',
        'linear-gradient(120deg, transparent 48%, rgba(120,130,150,0.1) 49% 50%, transparent 51%)',
      ].join(',');
    case 'none':
    default:
      return 'none';
  }
}

function getPaperBackgroundPosition(position: ResumeStyleConfig['paperBackgroundPosition']) {
  switch (position) {
    case 'left':
      return 'left top';
    case 'center':
      return 'center top';
    case 'right':
    default:
      return 'right top';
  }
}

function getPaperBackgroundSize(variant: ResumeStyleConfig['paperBackgroundVariant']) {
  if (variant === 'none') {
    return 'auto';
  }
  if (variant === 'diamond-grid' || variant === 'chevron' || variant === 'geo-frame' || variant === 'angle-grid') {
    return '36mm 36mm';
  }
  return '150mm 100mm';
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const fallback = `rgba(65, 131, 255, ${alpha})`;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return fallback;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildTypography(styleConfig: ResumeStyleConfig): ResumeTypography {
  const visualBaseSize = Math.max(styleConfig.fontSize - 3, 9);
  const titleSizePt = visualBaseSize + 1.2;
  const bodySizePt = visualBaseSize;
  const metaSizePt = Math.max(bodySizePt - 0.4, 8);
  const sectionBadgeSizePt = titleSizePt + 0.8;
  const nameSizePt = titleSizePt + 8;
  const baseLineHeightPt = buildVerticalSpacing(styleConfig).bodyTextLineHeightPt;

  return {
    nameSizePt,
    nameLineHeightPt: Math.round(baseLineHeightPt * 1.5),
    titleSizePt,
    titleLineHeightPt: Math.round(baseLineHeightPt * 1.0),
    bodySizePt,
    bodyLineHeightPt: baseLineHeightPt,
    metaSizePt,
    metaLineHeightPt: Math.round(baseLineHeightPt * 0.9),
    sectionBadgeSizePt,
    sectionBadgeLineHeightPt: Math.round(baseLineHeightPt * 1.2),
  };
}
