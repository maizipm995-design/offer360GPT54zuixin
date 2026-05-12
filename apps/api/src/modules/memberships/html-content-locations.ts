import {
  CAREER_JOURNEY_CONTENT_HTML,
  CAREER_JOURNEY_CONTENT_SLUG,
  CAREER_JOURNEY_CONTENT_TITLE,
} from './career-journey-content';
import {
  MEMBERSHIP_BENEFITS_CONTENT_HTML,
  MEMBERSHIP_BENEFITS_CONTENT_SLUG,
  MEMBERSHIP_BENEFITS_CONTENT_TITLE,
} from './membership-benefits-content';

export type HtmlContentLocationCode = 'membership-benefits' | 'career-journey';

export interface HtmlContentLocationDefinition {
  code: HtmlContentLocationCode;
  label: string;
  description: string;
  slug: string;
  title: string;
  defaultHtml: string;
  uploadScene: 'membership-content-image' | 'career-journey-content-image';
}

export const HTML_CONTENT_LOCATIONS: HtmlContentLocationDefinition[] = [
  {
    code: 'membership-benefits',
    label: '会员权益展示位',
    description: '用于前端会员开通页面底部的 HTML 富文本展示区域。',
    slug: MEMBERSHIP_BENEFITS_CONTENT_SLUG,
    title: MEMBERSHIP_BENEFITS_CONTENT_TITLE,
    defaultHtml: MEMBERSHIP_BENEFITS_CONTENT_HTML,
    uploadScene: 'membership-content-image',
  },
  {
    code: 'career-journey',
    label: '我的求职之路展示位',
    description: '用于前端“我的求职之路”页面的整页 HTML 富文本内容。',
    slug: CAREER_JOURNEY_CONTENT_SLUG,
    title: CAREER_JOURNEY_CONTENT_TITLE,
    defaultHtml: CAREER_JOURNEY_CONTENT_HTML,
    uploadScene: 'career-journey-content-image',
  },
];

export function getHtmlContentLocationDefinition(code: string): HtmlContentLocationDefinition {
  const location = HTML_CONTENT_LOCATIONS.find((item) => item.code === code);
  if (!location) {
    throw new Error(`Unknown html content location: ${code}`);
  }
  return location;
}
