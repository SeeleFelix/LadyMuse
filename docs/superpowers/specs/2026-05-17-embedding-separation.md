# Embedding 独立化

> 状态：已确认

## 目标

将 embedding 生成从导入流程拆出，作为独立、可续做、增量式的操作，避免每次同步都重新生成全量 embedding 浪费 API 费用。

## 后端变更

### 新增 `POST /api/knowledge/embed`

```json
// 请求体（全可选）
{}                                          // 全量缺失的
{ "dimension": "lighting" }                 // 某维度缺失的
{ "name": "rembrandt_lighting" }           // 单个概念

// 响应
{ "ok": true }
// 已运行时返回
{ "error": "Embedding already in progress", "status": {...} }  // 409
```

逻辑：查询 `art_concepts WHERE embedding IS NULL`（加可选过滤），逐批生成 embedding 并更新。已有 embedding 的跳过。走 SSE 推送进度。

### 新增 `GET /api/knowledge/embed/status`

```json
{ "total": 5230, "embedded": 1200, "missing": 4030 }
```

### 同步脚本变更

`sync-aat.ts` 和 `sync-wikipedia.ts` 移除嵌入步骤。导入完成即结束，不再调 `generateEmbeddings`。

## 前端变更

### 知识库页面

- 概念列表每项左侧加状态点：绿 = 有 embedding，灰 = 无 embedding
- 顶栏加"生成向量"按钮（全量缺失的），含进度条
- 维度选中后加"生成本维度向量"
- 概念详情面板：若缺失 embedding，显示"生成向量"按钮

### 进度

复用现有 SSE 连接 `/api/knowledge/sync/progress`，embedding 阶段新增 `source: "embedding"`。
