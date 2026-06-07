# 网站SEO优化整改需求

> **Workspace:** /Users/maizim/Documents/2605GPT54offer360

---

**User**

这个文件是历史对话记录 `/Users/maizim/Documents/2605GPT54offer360/apps/web/lib/执行网站SEO优化.md` ，请你继续执行任务： 
 
 页面SEO优化整改需求 
 
 一、问题现状 
 
 前期SEO优化落地后，笔试真题、AI简历优化、面试辅导等多个页面前端新增了多处说明类展示模块，相关文案内容直接面向普通用户外露展示，破坏原有页面布局与产品视觉体验，不符合页面设计规范。 
 
 二、优化要求 
 
 1. 前端视觉处理：全量移除所有页面上新增的用户可见说明模块、SEO说明文案，前端页面不再向访客展示任何优化补充的说明类文字，还原原有页面布局样式。 
 
 2. 爬虫适配方案：SEO相关关键词、说明文本、优化内容不删除，改为写入页面隐藏代码标签内（如隐藏meta标签、页面不可见结构化标签、隐藏dom等方式），实现搜索引擎爬虫可抓取识别、普通用户前端浏览不可见的效果。 
 
 3. 约束规则延续：继续遵循SEO优化基本原则，不新增任何页面，全部优化操作依托现有页面框架完成，仅通过代码层隐性配置实现收录优化，不在前端页面新增可见区块。

**Assistant**

我先逐页排查之前加出来的可见 SEO 文案区块，定位哪些页面需要恢复原布局，再把这些内容统一改成隐藏输出，保证源码保留、前端不显示。

我已经确认代码里有现成的 `seo-hidden-content` 组件可复用，下一步直接核对各页面当前是“可见说明”还是“隐藏输出”，尽量少改布局、集中收口。

首页已经部分改成隐藏了，但 `services`、`membership`、`career-journey`、`resume-optimizer`、`interview-transcript` 里仍有明显可见的 SEO 说明块；我继续把题库分类页、专项页、题目页一起核对，避免遗漏。

我已经定位到整改边界了：工具页和栏目页里大部分问题都来自“客户端主体外又包了一层说明区”。接下来我会把这些可见区全部回收成隐藏容器，只保留原有业务组件和必要结构化数据。

我还发现一个风险点：不只是页面文件，个别客户端组件里也可能混进了 SEO 说明文案。我先把这些组件也抽查一下，确保不会只清一半。

我准备开始改文件了，目标是两步一起完成：
- 把所有新增的可见 SEO 说明区改成 `SeoHiddenContent` 或隐藏内链
- 让页面只保留原业务组件、原交互和结构化数据，不再额外挂可见说明块

然后我会跑诊断、`npm run dev:apps:rebuild`，最后补一条 CODEBUDDY 记忆更新。

我开始落代码了。会优先处理最明显的几个页面：`services`、`membership`、`career-journey`、`resume-optimizer`、`interview-transcript`，然后再收口题库页。

前五个核心页已经收掉了。我现在处理题库页，把“说明型卡片”和“练习建议”这类新增展示块回收到隐藏内容里，尽量不碰原刷题交互。

我已经把核心可见说明块大部分收掉了。现在做一轮回查，确认有没有残留的 FAQ、竞品说明、留学生说明之类仍然在前端可见。

代码诊断已经过了，我现在跑实际验证：先过一遍 `lint`，再按你的要求执行 `npm run dev:apps:rebuild`，确认 Docker 预览环境能正常更新。

验证已经通过，Docker 环境也重启成功了。我最后补一下这次任务的记忆记录，并把本地预览地址挂出来。

**已完成**
- 已继续执行整改，把前期新增的可见 SEO 说明模块改为隐藏输出，普通用户前端不再看到补充说明文案，页面回到以原业务内容和原交互为主的展示形态。
- 已保留 SEO 文本、关键词与互链信号，统一通过隐藏 DOM 继续输出，核心依赖为 [seo-hidden-content.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/common/seo-hidden-content.tsx) 和 [seo-link-cluster.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/common/seo-link-cluster.tsx)。
- 已同步更新 [CODEBUDDY.md](file:///Users/maizim/Documents/2605GPT54offer360/CODEBUDDY.md) 记忆记录。

**本次改动**
- 首页与核心栏目页已收口隐藏 SEO 输出：
  [page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/page.tsx)
  [services/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/services/page.tsx)
  [membership/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/membership/page.tsx)
  [career-journey/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/career-journey/page.tsx)
- 工具页已移除可见 FAQ、流程说明、竞品说明等新增块，改为隐藏输出：
  [resume-optimizer/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/resume-optimizer/page.tsx)
  [interview-transcript/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/interview-transcript/page.tsx)
- 题库页已回收可见说明型卡片和练习建议类文案，保留原练习入口与核心内容：
  [campus-exam/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/page.tsx)
  [category/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/category/%5BcategorySlug%5D/page.tsx)
  [special/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/special/%5BspecialId%5D/page.tsx)
  [question/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/question/%5BquestionId%5D/page.tsx)

**验证结果**
- `GetDiagnostics` 检查本次改动文件，均无新增报错。
- `npm run lint:web` 通过。
- `npm run dev:apps:rebuild` 通过。
- 本地预览已更新：[http://localhost:13000](http://localhost:13000)

**说明**
- 这次是“前端可见整改”，不是删除 SEO 内容；相关文本仍在源码中，搜索引擎可抓，普通访客不可见。
- 我没有新增任何页面或路由，也没有改动站点架构，只在现有页面里把可见说明改成隐性输出。

**下一步**
- 你可以直接打开 [http://localhost:13000](http://localhost:13000) 人工验收页面视觉。
- 如果你要，我下一步可以继续做一轮“视觉回归复查清单”，逐页帮你核对还有没有残留的可见 SEO 痕迹。

---

**User**

SEO优化： 
 网站定位优化：Offer360 致力于打造中国校招招聘信息汇总平台中的权威入口, 
 SEO关键词优化：实习校招、招聘公告、实习、春招、秋招、夏招、AI简历优化、面试辅导、校招笔试真题、面试逐字稿、求职全流程、大学生、留学生、海归； 
 请你再综合评估，“在不新增任何页面或路由，也没有改动站点架构的前提下”还有哪些需要优化点

**Assistant**

我先按“站点级信号、可抓取性、深层页发现、页面语义一致性”四个维度复查当前实现，给你一份不新增页面/路由前提下的剩余优化清单。

我已经看到两个最关键的残余短板了：一是部分深层题库页正文仍然依赖客户端取数，二是动态深层页的 TDK 和 sitemap 还偏通用。再补一小轮代码核对后，我给你按优先级出最终清单。

**综合结论**
- 在“不新增页面或路由、不改动站点架构”的前提下，当前最值得继续优化的，已经不是再堆更多关键词，而是把现有高价值深层页做成“更稳定可抓、实体词更准确、发现入口更完整”。
- 站点级口径、基础 `robots`、结构化数据、核心栏目页 TDK 已经有基础；剩余优化重点集中在题库深层页、动态详情页 metadata 精细度、以及 sitemap 的深度覆盖。

**P0 优先做**
- 深层题库页仍偏客户端取数，爬虫抓正文稳定性不够。
  [category/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/category/%5BcategorySlug%5D/page.tsx#L1-L28)、
  [special/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/special/%5BspecialId%5D/page.tsx#L1-L24)、
  [question/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/question/%5BquestionId%5D/page.tsx#L35-L53)
  都还是 `use client + clientFetch` 拉详情；这意味着 HTML 首屏对搜索引擎并不稳定。下一步最值钱的是把这三类页改成服务端取数或至少服务端预渲染正文，不新增路由也能做。
- 题目详情页还没进 `sitemap.xml`，长尾收录入口仍然偏弱。
  [sitemap.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/sitemap.ts#L72-L108)
  当前只纳入了分类页和专项页，没有纳入 `/campus-exam/question/[questionId]`。如果题目页是长尾主战场，这一项优先级很高。
- 动态题库页的 TDK 还比较通用，没有吃到真实实体词。
  [category/head.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/category/%5BcategorySlug%5D/head.tsx#L8-L21)、
  [special/head.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/special/%5BspecialId%5D/head.tsx#L8-L21)、
  [question/head.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/campus-exam/question/%5BquestionId%5D/head.tsx#L8-L21)
  现在基本还是模板标题，没有真实分类名、专项名、题型名、题目实体。即使不改路由，也可以在服务端拿数据后输出更精准的 title/description/keywords。

**P1 建议紧接做**
- `sitemap` 的 `lastModified` 还是统一用当前时间，时效信号失真。
  [sitemap.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/sitemap.ts#L9-L108)
  现在所有 URL 都用 `new Date()`，这对搜索引擎不是理想信号。更好的做法是优先使用服务、分类、专项、题目的真实更新时间字段。
- 服务详情页 metadata 还偏泛，没完全承接你定义的整套站点词池。
  [services/[id]/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/services/%5Bid%5D/page.tsx#L46-L64)
  现在关键词更多是“服务名 + 求职服务 + 校招辅导”，但还可以继续下沉 `实习校招`、`招聘公告`、`求职全流程`、`大学生`、`留学生`、`海归` 这些站点级词。
- 站点级默认关键词还可以再做“精确词根补齐”。
  [seo.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/lib/seo.ts#L17-L40)
  目前已有 `大学生求职`、`留学生求职`、`海归求职`，但如果你要更强地贴合你刚给的目标词，建议额外保留裸词 `大学生`、`留学生`、`海归`，以及把 `招聘公告`、`求职全流程` 在更多页面级 metadata 中做 exact match。
- 结构化数据还可以再细一层，不止站点级和基础页面级。
  [layout.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/layout.tsx#L21-L45)、
  [seo.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/lib/seo.ts#L278-L410)
  现在已有 `Organization`、`WebSite`、`BreadcrumbList`、`Service`、`WebPage`，但题库分类/专项/题目页还可以补更贴近内容实体的 `CollectionPage`、更完整 breadcrumb、以及题目层的语义字段。

**P2 后续增强**
- `resume-optimizer` 和 `interview-transcript` 的核心公开语义仍主要依赖页面 metadata 与隐藏内容，组件层公开可抓内容还可以再稳一点。
  [resume-optimizer/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/resume-optimizer/page.tsx#L22-L47)、
  [interview-transcript/page.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/%28site%29/interview-transcript/page.tsx#L24-L50)
  当前“用户不可见 SEO 文本”策略已经满足视觉要求，但如果后续追求更强收录，最好让工具页在服务端仍能输出一小段稳定正文摘要，而不是主要依赖隐藏内容。
- 竞品词覆盖已进入核心页面，但还可以做更细的“对比意图落点分配”。
  例如 `超级简历` 更偏简历工具，`粉笔/中公/华图` 更偏训练与考试场景，适合继续按页面分层，而不是主要集中在站点级词池。
- 页面标题还能进一步统一“品牌词 + 主词 + 人群词”的公式。
  当前不同页面风格不完全一致，有的偏功能词，有的偏栏目词。后续可以统一成更稳定的模板，减少站内口径漂移。

**不建议继续加码的方向**
- 不建议再继续堆更多隐藏关键词，收益会越来越低。
- 不建议再扩大 `robots` 放开范围到登录、支付、个人中心等区域。
  [robots.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/app/robots.ts#L10-L43)
  当前边界整体是合理的，继续放开风险大于收益。
- 不建议只改更多文案而不改深层页抓取方式。
  当前最影响收录上限的，不是“词不够多”，而是“深层正文是否稳定被抓到”。

**按收益排序的下一步**
- 第 1 步：把题库 `分类页 / 专项页 / 题目页` 改成服务端取数或预渲染正文。
- 第 2 步：把 `question` 详情页补进 `sitemap.xml`。
- 第 3 步：把 `category/special/question` 的通用 `head.tsx` 升级成真实实体词 metadata。
- 第 4 步：把服务详情页 metadata 补齐你指定的站点核心词和人群词。
- 第 5 步：把 `lastModified` 改成真实内容更新时间。

**一句话判断**
- 现在剩余最该优化的，不是首页，也不是再加更多品牌词，而是“题库深层页 SSR/预渲染 + 题目 sitemap + 动态实体 TDK”这三件事。

如果你要，我下一步可以直接按这个优先级，先帮你做第 1 项和第 2 项：`题库深层页服务端化 + question 详情页补进 sitemap`。

---

**User**

- 第 1 步：把题库 分类页 / 专项页 / 题目页 改成服务端取数或预渲染正文。 
 - 第 2 步：把 question 详情页补进 sitemap.xml 。 
 - 第 3 步：把 category/special/question 的通用 head.tsx 升级成真实实体词 metadata。 
 - 第 4 步：把服务详情页 metadata 补齐你指定的站点核心词和人群词。

**Assistant**

我先把题库数据链路和现有页面实现对齐：确认服务端能直接拿哪些分类/专项/题目数据、题目列表从哪里来，然后再一次性改 SSR、metadata 和 sitemap。

我已经确认前端类型足够支撑服务端渲染，下一步去对齐后端公开接口和题目列表来源，重点看有没有现成接口能拉出题目 ID 用于 sitemap。

我准备开始改了：会把数据抓取前移到服务端，同时保留现有练习入口的登录/会员拦截体验；另外顺手把动态 metadata 和 sitemap 一起补齐，避免只做 SSR 不补发现入口。

我会把题库页改成“服务端拿公开正文 + 客户端只负责会员拦截和登录态增强”的结构，这样既能保住 SEO 抓取，又不丢原来的交互能力。

我已经把题目 URL 数据源接上了，但 sitemap 这里我再顺手收一刀，避免题目路由在每个分类循环里重复拼装后再去重，直接改成一次性追加，结构会更稳。

---

