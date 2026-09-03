export const PRICING_PACKS = [
  { id: "starter", credits: 5, price: "$6.99", unitPrice: "$1.40", name: { zh: "先试一小套", en: "Try a small set" }, description: { zh: "第一次用？先做 5 个看看效果，喜欢再继续。", en: "New here? Make 5 icons, see how they turn out, then decide if you want more." } },
  { id: "creator", credits: 20, price: "$24.99", unitPrice: "$1.25", featured: true, name: { zh: "认真做个产品", en: "Build out a product" }, description: { zh: "首页、导航、常用功能都照顾到，一包基本够用。", en: "Cover the home screen, navigation, and everyday actions in one pack." } },
  { id: "professional", credits: 50, price: "$54.99", unitPrice: "$1.10", name: { zh: "手上不止一个项目", en: "More than one project" }, description: { zh: "页面多、版本多，想做的时候就做，不用总惦记着充值。", en: "Keep enough credits around for new screens, new releases, and the next project." } },
  { id: "team", credits: 100, price: "$99.99", unitPrice: "$1.00", name: { zh: "团队一起做", en: "Make icons as a team" }, description: { zh: "适合多人、多项目一起推进，数量越多越划算。", en: "Made for teams moving several projects forward at the same time." } },
] as const;

export function findPricingPack(packId: string) {
  return PRICING_PACKS.find((pack) => pack.id === packId);
}
