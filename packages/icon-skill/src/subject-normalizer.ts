const FUNCTIONAL_TERMS = /^(?:返回|后退|关闭|取消|更多|菜单|搜索|查找|筛选|过滤|设置|排序|刷新|重载|分享|复制|下载|上传|添加|新增|删除|移除|编辑|修改|保存|back|close|dismiss|more|menu|search|filter|settings|sort|refresh|reload|share|copy|download|upload|add|delete|remove|edit|save)(?:图标)?$/i;

export type IconCategory = "illustrative" | "functional";

export function inferIconCategory(name: string, description: string): IconCategory {
  const content = `${name} ${description}`;
  const hasIllustrativeObject = /女孩|男孩|人物|头像|角色|动物|小熊|猫|狗|恐龙|汽车|火车|房子|场景|花|树|食物|咖啡|girl|boy|portrait|character|animal|bear|cat|dog|dinosaur|car|train|scene/i.test(content);
  return !hasIllustrativeObject && FUNCTIONAL_TERMS.test(name.trim()) ? "functional" : "illustrative";
}

export function normalizeSubjectDescription(name: string, description: string, category: IconCategory) {
  const cleanName = name.trim().replace(/[。.!！]+$/g, "");
  const cleanDescription = description.trim().replace(/[。.!！]+$/g, "");
  const distinct = cleanDescription && cleanDescription !== cleanName ? cleanDescription : "";
  if (category === "functional")
    return distinct
      ? `${cleanName}: ${distinct}. Keep only the standard symbol structures required to communicate this action.`
      : `${cleanName}: use the most familiar direct operation symbol with rounded turns, balanced negative space, and a clear optical center.`;
  const character = /女孩|男孩|人物|头像|角色|girl|boy|portrait|character/i.test(`${cleanName} ${cleanDescription}`);
  const base = distinct ? `${cleanName}: ${distinct}` : cleanName;
  return character
    ? `${base}. Show one complete centered character with friendly rounded proportions, a clearly readable hairstyle silhouette, a simple natural expression, and legible facial features; do not add a second character.`
    : `${base}. Show one complete centered subject through its most recognizable silhouette, proportion, pose, and essential structure; do not add a second subject or unrelated scene.`;
}
