import type { MetadataRoute } from 'next';
import { serverGet } from '@/lib/api';
import type { CampusExamHomePayload } from '@/lib/campus-exam';
import { getCampusExamSpecialDetail } from '@/lib/campus-exam-page-data';
import { getAbsoluteUrl } from '@/lib/seo';
import type { ServiceItem } from '@/types';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: getAbsoluteUrl('/services'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl('/membership'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: getAbsoluteUrl('/career-journey'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: getAbsoluteUrl('/campus-exam'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl('/resume-optimizer'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: getAbsoluteUrl('/interview-transcript'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
  ];

  let serviceRoutes: MetadataRoute.Sitemap = [];
  try {
    const services = await serverGet<ServiceItem[]>('/service-products');
    serviceRoutes = services
      .filter((service) => service.id?.trim())
      .map((service) => ({
        url: getAbsoluteUrl(`/services/${encodeURIComponent(service.id)}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.75,
      }));

  } catch (error) {
    console.error('Failed to build dynamic service sitemap routes.', error);
  }

  let campusExamRoutes: MetadataRoute.Sitemap = [];
  try {
    const campusExamHome = await serverGet<CampusExamHomePayload>('/campus-exam/home');
    const specialIds = Array.from(
      new Set(
        campusExamHome.categoryTree.flatMap((category) => category.specials
          .filter((special) => special.questionCount > 0)
          .map((special) => String(special.id))),
      ),
    );
    const specialDetails = await Promise.allSettled(specialIds.map((specialId) => getCampusExamSpecialDetail(specialId)));

    const questionRoutes = specialDetails.flatMap((result) => {
      if (result.status !== 'fulfilled') {
        return [];
      }
      const specialUpdatedAt = result.value.updatedAt ? new Date(result.value.updatedAt) : now;
      return (result.value.questionIds ?? []).map((questionId) => ({
        url: getAbsoluteUrl(`/campus-exam/question/${encodeURIComponent(questionId)}`),
        lastModified: specialUpdatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.68,
      }));
    });
    const specialLastModifiedMap = new Map(
      specialDetails.flatMap((result) => {
        if (result.status !== 'fulfilled') {
          return [];
        }

        return [[String(result.value.id), result.value.updatedAt ? new Date(result.value.updatedAt) : now] as const];
      }),
    );

    campusExamRoutes = campusExamHome.categoryTree.flatMap((category) => {
      const categoryPath = `/campus-exam/category/${encodeURIComponent(category.slug)}`;
      const specialRoutes: MetadataRoute.Sitemap = category.specials
        .filter((special) => special.questionCount > 0)
        .map((special) => {
          const path = `/campus-exam/special/${encodeURIComponent(String(special.id))}`;
          return {
            url: getAbsoluteUrl(path),
            lastModified: specialLastModifiedMap.get(String(special.id)) ?? now,
            changeFrequency: 'weekly',
            priority: 0.72,
          };
        });

      return [
        {
          url: getAbsoluteUrl(categoryPath),
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.76,
        },
        ...specialRoutes,
      ];
    });

    campusExamRoutes.push(...questionRoutes);

    campusExamRoutes = campusExamRoutes.filter((route, index, list) => (
      list.findIndex((item) => item.url === route.url) === index
    ));
  } catch (error) {
    console.error('Failed to build campus exam sitemap routes.', error);
  }

  return [...staticRoutes, ...serviceRoutes, ...campusExamRoutes];
}
