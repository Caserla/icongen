# AWS 部署

该模板部署生成队列、死信队列、Lambda Worker 和 DLQ 告警，默认区域建议为 `us-east-1`。

```bash
cp infra/aws/samconfig.toml.example infra/aws/samconfig.toml
sam build --template-file infra/aws/template.yaml
sam deploy --guided
```

部署时通过 `ImageProvider`、`ImageModel` 和 `IconSkill` 参数选择已注册的模型适配器及 Skill。生产环境建议将模型供应商与 Supabase 密钥改为 AWS Secrets Manager 动态引用；模板参数仅用于 MVP 首次部署。部署输出的 `GenerationQueueUrl` 配置到 Vercel BFF，BFF 只拥有向该队列发送消息的权限。
