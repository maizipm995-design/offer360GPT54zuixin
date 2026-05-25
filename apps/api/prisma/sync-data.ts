import { PrismaClient } from '@prisma/client';
import { serviceProductSeedItems } from './reference-data';

const prisma = new PrismaClient();

const MEMBERSHIP_BENEFITS_CONTENT_SLUG = 'offer360-membership-benefits';
const MEMBERSHIP_BENEFITS_CONTENT_TITLE = 'offer360求职会员权益说明';
const MEMBERSHIP_BENEFITS_CONTENT_HTML = `
<section class="membership-rich-section">
  <h3>权益一：24小时实时更新校招信息，全、准、快、新</h3>
  <div class="membership-rich-lead">
    <h4>求职信息，贵在及时与全面！</h4>
    <p>
      成为会员后，平台平均每日更新超50家企业的校招信息，更新周期长达6个月，截至目前已累计更新2025年全行业12000+条校招资讯。你可通过offer360电脑端官网、手机端筛选并投递岗位，第一时间掌握最新校招动态。
    </p>
    <p>
      加入专属校招会员群，每个工作日都能获取最新校招资讯，确保会员不会错失简历投递的黄金窗口期、补录捡漏期以及冲刺收尾期。
    </p>
  </div>
  <div class="membership-rich-grid">
    <article class="membership-rich-item">
      <h5>信息全面且新鲜</h5>
      <p>
        平台每日整理并更新20至80条校招信息（校招高峰期数量会有所增加），23届至26届毕业生均可找到适配的投递岗位，覆盖秋招、秋招提前批、秋招补录、春招、春招提前批、春招补录、实习等各类招聘批次。
      </p>
    </article>
    <article class="membership-rich-item">
      <h5>覆盖行业广泛</h5>
      <p>
        招聘信息按行业精细分类，涵盖国企央企、外资企业、事业单位、民营企业等各类企业性质，以及互联网、快消、金融、制造业、文娱传媒、新能源、医药、法律、会计师事务所等全行业校招信息。
      </p>
    </article>
    <article class="membership-rich-item">
      <h5>信息来源官方可靠</h5>
      <p>
        所有校招信息均100%来源于企业官方招聘网站、高校就业指导中心平台、合作企业官方发布渠道，确保信息的真实性与有效性。
      </p>
    </article>
  </div>
</section>
`.trim();

async function main() {
  console.log('开始同步商品数据...');
  for (const item of serviceProductSeedItems) {
    await prisma.serviceProduct.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        score: item.score,
        salesCount: item.salesCount,
        isHot: item.isHot,
        status: true,
        productType: item.productType as any,
        memberLevel: (item as any).memberLevel ?? null,
        grantDays: (item as any).grantDays ?? null,
        detailHtml: item.detailHtml ?? null,
        orderServiceText: item.orderServiceText ?? null,
        orderServiceImageUrl: item.orderServiceImageUrl ?? null,
      },
      create: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        score: item.score,
        salesCount: item.salesCount,
        isHot: item.isHot,
        status: true,
        productType: item.productType as any,
        memberLevel: (item as any).memberLevel ?? null,
        grantDays: (item as any).grantDays ?? null,
        detailHtml: item.detailHtml ?? null,
        orderServiceText: item.orderServiceText ?? null,
        orderServiceImageUrl: item.orderServiceImageUrl ?? null,
      },
    });
  }
  console.log('商品数据同步完成。');

  console.log('开始同步会员权益说明...');
  await prisma.membershipRichTextContent.upsert({
    where: { slug: MEMBERSHIP_BENEFITS_CONTENT_SLUG },
    update: {
      title: MEMBERSHIP_BENEFITS_CONTENT_TITLE,
      htmlContent: MEMBERSHIP_BENEFITS_CONTENT_HTML,
      status: 'published',
    },
    create: {
      slug: MEMBERSHIP_BENEFITS_CONTENT_SLUG,
      title: MEMBERSHIP_BENEFITS_CONTENT_TITLE,
      htmlContent: MEMBERSHIP_BENEFITS_CONTENT_HTML,
      status: 'published',
      version: 1,
    },
  });
  console.log('会员权益说明同步完成。');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
