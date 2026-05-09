import { Injectable } from '@nestjs/common';
import { parseJobTextDate } from '../../common/utils/job-text-date';
import { PrismaService } from '../../prisma.service';
import { subDays } from '../jobs/jobs.utils';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getJobStats() {
    const now = new Date();
    const [entryDates, total] = await Promise.all([
      this.prisma.jobAnnouncement.findMany({ select: { entryDate: true } }),
      this.prisma.jobAnnouncement.count(),
    ]);

    const parsedEntryDates = entryDates
      .map((item) => parseJobTextDate(item.entryDate))
      .filter((item): item is Date => Boolean(item));

    return {
      threeDays: parsedEntryDates.filter((item) => item.getTime() >= subDays(now, 3).getTime()).length,
      sevenDays: parsedEntryDates.filter((item) => item.getTime() >= subDays(now, 7).getTime()).length,
      thirtyDays: parsedEntryDates.filter((item) => item.getTime() >= subDays(now, 30).getTime()).length,
      total,
    };
  }
}
