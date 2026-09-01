# Icon taxonomy v1：一级与二级分类清单

> 历史研究资料：本清单不参与当前运行时设置。当前用户可见参数以[当前实现基线](../project/current-implementation-baseline.md)和共享 Schema 为准。

版本：`taxonomy-2026-08-20.1`

来源：《UI图标生成器分类体系》逐表校对结果。

## 1. 校对结论

- 一级分类固定为 10 个设计维度。
- 二级分类逐表合计 266 项。
- 此前需求中出现的“286 项”属于数量标注错误，不再作为验收目标，也不补造 20 个不存在的选项。
- 英文名称统一使用附件表格中的完整规范名称；接口值后续由英文名称生成稳定 slug，但历史 ID 发布后不得修改。
- 选项可能在不同一级分类中同名，例如 `Clay` 同时属于 Visual Style 和 Material；接口必须带一级分类命名空间。

## 2. 一级分类汇总

| 顺序 | 一级分类 ID | 英文名称 | 中文名称 | 二级数量 |
| ---: | --- | --- | --- | ---: |
| 1 | `graphic-type` | Graphic Type | 图形类型 | 12 |
| 2 | `background-container` | Background Container | 背景容器 | 19 |
| 3 | `visual-style` | Visual Style | 视觉风格 | 81 |
| 4 | `representation` | Representation | 表现形式 | 27 |
| 5 | `camera-view` | Camera / View | 视角 | 14 |
| 6 | `material` | Material | 材质 | 29 |
| 7 | `shape-language` | Shape Language | 造型语言 | 21 |
| 8 | `color-scheme` | Color Scheme | 配色方式 | 33 |
| 9 | `complexity` | Complexity | 复杂度 | 10 |
| 10 | `shadow-lighting` | Shadow & Lighting | 阴影与光效 | 20 |
|  |  |  | 合计 | **266** |

## 3. 二级分类完整清单

### 3.1 Graphic Type / 图形类型（12）

1. Outline / Line（线性）
2. Monoline（单线条）
3. Bold Outline（粗描边）
4. Filled / Solid（面性）
5. Line + Fill（线面结合）
6. Duotone（双色分层）
7. Multicolor（多色）
8. Layered（分层）
9. Silhouette（剪影）
10. Negative Space（负形）
11. Translucent（半透明）
12. Gradient Filled（渐变填充）

### 3.2 Background Container / 背景容器（19）

1. None / Backgroundless（无背景）
2. Circle（圆形）
3. Square（方形）
4. Rounded Square（圆角方形）
5. Squircle（超椭圆）
6. Pill / Capsule（胶囊形）
7. Oval（椭圆形）
8. Blob（有机形）
9. Diamond（菱形）
10. Hexagon（六边形）
11. Octagon（八边形）
12. Shield（盾牌形）
13. Badge / Seal（徽章形）
14. Bubble（气泡形）
15. Teardrop（水滴形）
16. Star（星形）
17. Starburst（放射形）
18. Chamfered Rectangle（切角矩形）
19. Custom Shape（自定义形状）

### 3.3 Visual Style / 视觉风格（81）

1. Modern（现代）
2. Flat Design（扁平设计）
3. Minimal（极简）
4. Soft UI（柔和 UI）
5. Material（Material Design）
6. Fluent（Fluent Design）
7. iOS / SF Symbols Style（苹果系统风格）
8. Corporate（企业商务）
9. Swiss Style（瑞士平面）
10. Editorial（编辑插画）
11. Clay（黏土）
12. Iso 3D（等距 3D）
13. Skeuomorphic（拟物）
14. Inflatable（充气）
15. Glossy（高光亮面）
16. Matte（哑光）
17. Embossed（浮雕）
18. Engraved（雕刻）
19. Papercut（剪纸）
20. Paper Craft（纸艺）
21. Illustration（插画）
22. Cute Sticker（可爱贴纸）
23. Sticker（贴纸）
24. Cartoon（卡通）
25. Comic（漫画）
26. Kawaii（日系可爱）
27. Chibi（Q 版）
28. Anime（动漫）
29. Doodle（涂鸦）
30. Sketch（素描）
31. Hand-drawn（手绘）
32. Storybook（绘本）
33. Children’s Illustration（儿童插画）
34. Line Illustration（线稿插画）
35. Botanical（植物插画）
36. Watercolor（水彩）
37. Gouache（水粉）
38. Oil Painting（油画）
39. Crayon（蜡笔）
40. Marker（马克笔）
41. Ink（墨水画）
42. Risograph（孔版印刷）
43. Halftone（半色调网点）
44. Geometric（几何）
45. Polygon（多边形）
46. Low Poly（低多边形）
47. Pixel Art（像素艺术）
48. 8-bit（8 位像素）
49. 16-bit（16 位像素）
50. Voxel（体素）
51. Retro（复古）
52. Vintage（怀旧）
53. Y2K（千禧风）
54. Memphis（孟菲斯）
55. Bauhaus（包豪斯）
56. Art Deco（装饰艺术）
57. Pop Art（波普艺术）
58. Psychedelic（迷幻）
59. Grunge（做旧粗粝）
60. Vaporwave（蒸汽波）
61. Synthwave（合成器浪潮）
62. Cyberpunk（赛博朋克）
63. Futuristic（未来主义）
64. Sci-Fi（科幻）
65. HUD（科幻界面）
66. Mecha（机甲）
67. Arcade（街机）
68. Game Asset（游戏资产）
69. RPG（角色扮演游戏）
70. Fantasy（奇幻）
71. Game Badge（游戏徽章）
72. Achievement Icon（成就图标）
73. Neon（霓虹）
74. Glow（发光）
75. Glassmorphism（玻璃拟态）
76. Frosted Glass（磨砂玻璃）
77. Holographic（全息镭射）
78. Iridescent（虹彩）
79. Aurora（极光）
80. Luminous（自发光）
81. X-ray（X 光透视）

### 3.4 Representation / 表现形式（27）

1. 2D Icon（二维图标）
2. 2.5D Icon（伪三维图标）
3. 3D Icon（三维图标）
4. Illustration（插画）
5. Line Illustration（线稿插画）
6. Spot Illustration（小型场景插画）
7. Logo（标志）
8. App Icon（应用图标）
9. Avatar（头像）
10. 3D Avatar（三维头像）
11. Mascot（吉祥物）
12. Character（角色）
13. Object（物体）
14. Scene（场景）
15. Badge（徽章）
16. Emblem（纹章式标志）
17. Glyph（符号图标）
18. Modern Logo（现代 Logo）
19. Lettermark（字母标）
20. Wordmark（文字标）
21. Monogram（组合字母标）
22. Pictorial Mark（具象图形标）
23. Abstract Mark（抽象图形标）
24. Combination Mark（图文组合标）
25. Mascot Logo（吉祥物 Logo）
26. Emblem Logo（徽章式 Logo）
27. Brand Glyph（品牌符号）

### 3.5 Camera / View / 视角（14）

1. Front（正视图）
2. Back（背视图）
3. Side（侧视图）
4. Three-quarter（四分之三视角）
5. Top（俯视图）
6. Bottom（仰视图）
7. Isometric（等距视角）
8. Axonometric（轴测视角）
9. Perspective（透视视角）
10. Orthographic（正交视图）
11. Floating（悬浮视角）
12. Exploded View（爆炸分解视图）
13. Close-up（特写）
14. Macro（微距）

### 3.6 Material / 材质（29）

1. None / Flat（无材质／纯色）
2. Clay（黏土）
3. Plastic（塑料）
4. Rubber（橡胶）
5. Gel（凝胶）
6. Jelly（果冻）
7. Liquid（液态）
8. Glass（玻璃）
9. Frosted Glass（磨砂玻璃）
10. Crystal（水晶）
11. Metal（金属）
12. Chrome（镀铬）
13. Gold（黄金）
14. Silver（银质）
15. Ceramic（陶瓷）
16. Paper（纸张）
17. Cardboard（纸板）
18. Fabric（织物）
19. Felt（毛毡）
20. Leather（皮革）
21. Wood（木材）
22. Stone（石材）
23. Concrete（混凝土）
24. Ice（冰）
25. Holographic Film（全息膜）
26. Neon Tube（霓虹灯管）
27. Inflatable Vinyl（充气乙烯）
28. Matte（哑光表面）
29. Glossy（光泽表面）

### 3.7 Shape Language / 造型语言（21）

1. Rounded（圆润）
2. Sharp（锐利）
3. Angular（棱角）
4. Organic（有机）
5. Geometric（几何）
6. Polygonal（多边形）
7. Symmetrical（对称）
8. Asymmetrical（非对称）
9. Chunky（厚重）
10. Slim（纤细）
11. Compact（紧凑）
12. Soft（柔软）
13. Bold（大胆）
14. Elegant（优雅）
15. Friendly（亲和）
16. Playful（活泼）
17. Technical（技术感）
18. Mechanical（机械感）
19. Futuristic（未来感）
20. Handcrafted（手工感）
21. Cute（可爱）

### 3.8 Color Scheme / 配色方式（33）

1. Monochrome（单色）
2. Two-tone（两色）
3. Duotone（双色调）
4. Multicolor（多色）
5. Gradient（渐变）
6. Gradient Mesh（网格渐变）
7. Duotone Gradient（双色渐变）
8. Iridescent（虹彩）
9. Holographic（全息）
10. Analogous（邻近色）
11. Complementary（互补色）
12. Split Complementary（分裂互补色）
13. Triadic（三角色）
14. Tetradic（四角色）
15. Neutral（中性色）
16. Black and White（黑白）
17. Grayscale（灰阶）
18. Pastel（马卡龙／粉彩）
19. Vibrant（鲜艳）
20. Muted（低饱和）
21. Soft（柔和）
22. Warm（暖色）
23. Cool（冷色）
24. Dark（深色）
25. Light（浅色）
26. High Contrast（高对比）
27. Low Contrast（低对比）
28. Earth Tone（大地色）
29. Candy Color（糖果色）
30. Neon Color（霓虹色）
31. Metallic Color（金属色）
32. Luxury Gold（奢华金色）
33. Aurora Gradient（极光渐变）

### 3.9 Complexity / 复杂度（10）

1. Ultra Minimal（超极简）
2. Minimal（极简）
3. Simple（简单）
4. Standard（标准）
5. Moderate（中等细节）
6. Detailed（精细）
7. Highly Detailed（高度精细）
8. Decorative（装饰型）
9. Realistic（写实）
10. Hyperrealistic（超写实）

### 3.10 Shadow & Lighting / 阴影与光效（20）

1. None（无阴影）
2. Soft Shadow（柔和阴影）
3. Hard Shadow（硬阴影）
4. Drop Shadow（外部投影）
5. Inner Shadow（内阴影）
6. Long Shadow（长阴影）
7. Ambient Shadow（环境阴影）
8. Ambient Occlusion（环境光遮蔽）
9. Contact Shadow（接触阴影）
10. Layered Shadow（分层阴影）
11. Floating Shadow（悬浮阴影）
12. Glow（发光）
13. Neon Glow（霓虹光晕）
14. Inner Glow（内发光）
15. Outer Glow（外发光）
16. Rim Light（轮廓光）
17. Backlight（逆光）
18. Dramatic Lighting（戏剧光影）
19. Soft Studio Light（柔和棚拍光）
20. Luminous（自发光）

## 4. 文档定位

- 本清单只保留为分类研究和未来版本参考，不是 MVP 的运行配置。
- MVP 前端、接口、后端和 Skill 只支持 ADR-0003 确认的 6 组、25 个核心选项。
- 未来如需高级模式，必须另行立项、重新定义冲突规则并建立版本化配置，不能直接把本表投入生产。

## 5. MVP 设置入口

首版设置以 [ADR-0003](../decisions/0003-simplified-ui-icon-controls.md) 为唯一依据，共 6 组、25 个核心选项，不提供 Advanced settings。
