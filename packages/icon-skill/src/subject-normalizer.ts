const FUNCTIONAL_TERMS = /^(?:返回|后退|关闭|取消|更多|菜单|搜索|查找|筛选|过滤|设置|排序|刷新|重载|分享|复制|下载|上传|添加|新增|删除|移除|编辑|修改|保存|back|close|dismiss|more|menu|search|filter|settings|sort|refresh|reload|share|copy|download|upload|add|delete|remove|edit|save)(?:图标)?$/i;

export type IconCategory = "illustrative" | "functional";

const TRANSPARENCY_OUTPUT_RULE =
  /(?:透明(?:背景|画布|底|边缘|区域|通道)|背景(?:透明|不需要|不要|去掉|移除)|真实透明|alpha\s*(?:channel|background|canvas)|rgba\s*(?:png|canvas)|无(?:底板|背景|天空|地面|投影)|不需要(?:任何)?背景|不要(?:底板|背景|天空|地面|投影)|主体.*之外.*透明|镂空.*之外.*透明|transparent\s*(?:background|canvas|png|edge|margin)|no\s+(?:background|backdrop|ground|floor|shadow)|without\s+(?:a\s+)?(?:background|backdrop|ground|floor|shadow))/i;

/**
 * Background/alpha output is controlled by generation settings. User subject copy
 * may describe the artwork, but must not override or duplicate that contract.
 */
export function stripUserTransparencyRules(description: string) {
  return description
    .split(/(?<=[。.!！；;])|[,，]/)
    .map((part) => part.trim())
    .filter((part) => part && !TRANSPARENCY_OUTPUT_RULE.test(part))
    .join("，")
    .replace(/[，。.!！；;]+$/g, "")
    .trim();
}

export function inferIconCategory(name: string, description: string): IconCategory {
  const content = `${name} ${description}`;
  const hasIllustrativeObject = /女孩|男孩|人物|头像|角色|动物|小熊|猫|狗|恐龙|汽车|火车|房子|场景|花|树|食物|咖啡|girl|boy|portrait|character|animal|bear|cat|dog|dinosaur|car|train|scene/i.test(content);
  return !hasIllustrativeObject && FUNCTIONAL_TERMS.test(name.trim()) ? "functional" : "illustrative";
}

export function normalizeSubjectDescription(name: string, description: string, category: IconCategory) {
  const cleanName = name.trim().replace(/[。.!！]+$/g, "");
  const cleanDescription = stripUserTransparencyRules(description)
    .replace(/[。.!！]+$/g, "");
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
