# 项目知识库

本目录是 EASY DESIGN / ICON GEN 的需求、技术方案和项目决策唯一入口。需求或技术方向变化时，先更新相应文档，再进入实现。

当前开发前必须先阅读[当前实现基线](project/current-implementation-baseline.md)。历史审计或原始 Word 文档与其冲突时，以共享 Schema、数据库迁移和当前实现基线为准。

## 产品

- [App 内交互图标风格图鉴（离线 HTML）](design/app-icon-style-atlas.html)
- [图标素材库与辅助网格预览实现方案](product/icon-library-implementation-plan.md)
- [产品概览](product/overview.md)
- [PRD 2.0：完整产品需求](product/product-requirements.md)
- [六个业务模块](product/business-modules.md)
- [用户信息、登录与账户模块需求](product/user-auth-account-requirements.md)
- [图片生成模块需求](product/icon-generation-requirements.md)
- [Icon taxonomy v1：一级与二级分类清单](product/icon-taxonomy-v1.md)
- [作品、支付与运营模块需求](product/works-billing-admin-requirements.md)
- [AI 生成成本与点数套餐策略](product/ai-cost-and-pricing-strategy.md)
- [六大业务模块前端页面规划](product/frontend-page-plan.md)
- [前端文案优化方案](product/frontend-copy-optimization-plan.md)
- [MVP 范围决策](decisions/0001-mvp-scope.md)
- [批量 UI 图标生成范围决策](decisions/0002-batch-ui-icon-generation.md)
- [UI 图标生成设置精简决策](decisions/0003-simplified-ui-icon-controls.md)
- [月付 VPS 测试部署基线决策](decisions/0004-monthly-vps-test-deployment.md)
- [当前充值与账户范围决策](decisions/0005-credit-topup-and-account-scope.md)

## 技术

- [技术架构概览](architecture/overview.md)
- [后端技术架构](architecture/backend.md)
- [SVG 输出链路调整方案](architecture/svg-output-adjustment-plan.md)
- [方案细节调整与版本还原](architecture/variant-detail-editing.md)
- [生成域数据字典](architecture/data-dictionary.md)
- [环境配置与测试索引](guides/environment-and-testing.md)
- [CD-Key 充值真实交互测试用例](testing/cd-key-redemption-e2e.md)
- [图标生成真实扣点测试用例](testing/generation-credit-debit-e2e.md)
- [图标生成全链路真实交互回归报告（2026-09-04）](testing/generation-flow-e2e-regression-2026-09-04.md)
- [全产品遗漏场景补充回归报告（2026-09-04）](testing/product-functional-gap-regression-2026-09-04.md)
- [浏览器竞态、恢复与兼容性验收（2026-09-04）](testing/browser-race-recovery-regression-2026-09-04.md)
- [UI 与图片加载回归（2026-09-04）](testing/ui-and-asset-loading-regression-2026-09-04.md)
- [生产安全代码底座回归测试](testing/production-security-regression.md)
- [安全基本闭环到生产级闭环方案](security/basic-to-production-security-plan.md)
- [基本安全闭环测试用例](testing/basic-security-closure-test-cases.md)
- [生产环境安全加固与人工操作清单](security/production-security-hardening-plan.md)
- [月付 VPS 测试部署指南](guides/monthly-vps-test-deployment.md)
- [单台 4 GB VPS 合并部署操作手册](guides/single-vps-deployment-runbook.md)
- [新加坡 Lightsail 首次部署操作日志（2026-09-05）](guides/singapore-lightsail-deployment-log-2026-09-05.md)
- [AI 模型与 Skill 配置说明书](guides/ai-model-and-skill-configuration.md)
- [管理后台与 CD-Key 运营手册](guides/admin-console-and-cd-key-operations.md)
- [登录与账户 API 前端调用手册](api/auth-account-frontend-guide.md)
- [登录与账户 OpenAPI 3.1 规范](api/auth-account.openapi.yaml)
- [图片生成 API v2 前端调用手册](api/generation-v2-frontend-guide.md)
- [原始 PRD Word 文档（历史参考，不作为当前口径）](reference/AI_Icon_Generator_PRD_v0.1.docx)
- [原始技术架构 Word 文档（历史参考，不作为当前口径）](reference/AI_Icon_Generator_Technical_Architecture_and_Overseas_Deployment_v1.0.docx)

## 项目管理

- [项目开发准则：UI 交互响应优先](project/development-principles.md)
- [2026-09-20 图标生成画布、收藏回收与下载交接](project/update-2026-09-20.md)
- [2026-09-19 图标生成工作区交互与数据闭环交接](project/update-2026-09-19.md)
- [2026-09-18 项目级 SVG 图标工作区交接](project/update-2026-09-18.md)
- [TODO 与推进顺序](project/todo.md)
- [当前实现基线](project/current-implementation-baseline.md)
- [前后端开发任务总表](project/development-master-plan.md)
- [用户信息、登录与账户开发任务](project/user-auth-account-development-tasks.md)
- [待确认事项](project/open-questions.md)
- [MVP 需求一致性审计](project/requirements-consistency-audit.md)
- [产品功能与生产闭环总表](project/functional-closure-audit-2026-09-04.md)
- [前后端代码与 UI 架构审计](project/code-and-ui-architecture-audit-2026-09-04.md)

## 维护约定

- 已确认结论写入 `docs/decisions/`，避免只留在聊天记录中。
- 业务范围变化时同步更新产品概览、业务模块和对应决策记录。
- 技术选型变化时同步更新架构概览并新增决策记录。
- 文档中暂未确认的内容必须明确标记为“待确认”，不可作为最终需求开发。
- 当前页面和交互口径以 PRD 2.0、前端页面规划、需求一致性审计及原子级开发计划为准；`docs/reference` 只保存立项初稿。
# 最新累计交接

- [2026-09-20 图标生成画布、收藏回收与下载交接](project/update-2026-09-20.md)
- [2026-09-19 图标生成工作区交互与数据闭环交接](project/update-2026-09-19.md)
- [2026-09-18 项目级 SVG 图标工作区交接](project/update-2026-09-18.md)
- [2026-09-09 工作区汇总与验收交接](project/update-2026-09-09.md)
- [EASY ICON 品牌统一（2026-09-09）](project/brand-update-2026-09-09.md)
