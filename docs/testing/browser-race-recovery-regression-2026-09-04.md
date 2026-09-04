# 浏览器竞态、恢复与兼容性验收（2026-09-04）

本轮使用真实浏览器、真实页面 API 和 Supabase 测试数据；破坏性场景使用专用临时账户或可清理夹具，不消耗业务账户点数。

| 场景 | 生产闭环标准 | 验收结果 | 待人工处理 |
| --- | --- | --- | --- |
| 双标签同时采用新图和还原 | 只允许一个写入成功，陈旧标签返回 409 | 通过；真实两页面同时点击得到 `409 / 200` | 否 |
| 断网、计时、恢复连接 | 显示连接提示；计时继续；联网后自动刷新 | 通过；`Updated 8s ago` → `Updated 10s ago`，恢复后自动 200 | 否 |
| Chromium / Firefox / WebKit | 创建页加载并可键盘操作 | 三引擎通过 | Safari 真机仍需人工 |
| 200% 文字缩放 | 无水平溢出，核心控件可操作 | 三引擎通过 | 建议发布前抽样真机 |
| 完整键盘主流程 | Tab、Enter、输入均可用 | 三引擎通过（36 / 28 / 23 个可聚焦控件） | 否 |
| 付费调整失败 | 扣 1 点、失败返 1 点、重复返还幂等、页面显示失败 | 专用测试任务全部通过 | staging Provider 真实 5xx 建议发布前演练 |

## 修复记录

- 版本还原接口通过 `expectedActiveRevisionId` 和条件更新实现 compare-and-swap，陈旧标签不能覆盖新状态。
- HSTS 与 `upgrade-insecure-requests` 仅在生产环境启用，修复 WebKit 在本地把 Next.js 脚本升级成 HTTPS 后卡在骨架屏的问题。
- 付费失败脚本创建临时用户、专用生成任务、三次免费调整历史和付费失败修订，结束后删除临时用户及级联数据。
- 断网脚本使用专用处理中任务和测试租约，避免 Worker 抢占夹具。

## 可重复执行

```bash
npm run test:e2e:browser-compat -- 04102198q@163.com
npm run test:e2e:races-recovery -- 04102198q@163.com 13c72d16-169b-4f49-94d0-49d26a49ed17
npm run test:e2e:paid-edit-refund -- 04102198q@163.com 13c72d16-169b-4f49-94d0-49d26a49ed17
```

## 仍需用户或运维闭环

1. Safari 真机（macOS、iPhone、iPad）视觉和触摸验收；Playwright WebKit 通过不能等同所有 Safari 设备组合。
2. staging 对真实 Provider 5xx、云服务器进程强杀和实际网络设备断网做发布演练；代码故障注入、数据库结算和浏览器失败态已通过。
3. 正式域名 HTTPS、反向代理、Auth 回调和 SMTP 需要部署凭据及外部服务配置后最终验收。
