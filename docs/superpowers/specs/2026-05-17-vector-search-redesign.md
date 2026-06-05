# 向量搜索彻底重设计

> 状态：已确认

## 背景

当前向量搜索存在严重问题：

1. **vec_concepts 表没有 `id` 列**——INSERT 引用不存在的列，导致嵌入流程崩溃
2. **只有 `find_concepts` 用了 sqlite-vec**——`find_patterns` 和 `find_references` 在 JS 里全表扫描算余弦相似度
3. **双存储冗余**——向量同时存 vec0 blob 和 artConcepts.embedding JSON，容易不一致
4. **vec0 表完全是空的**——43,433 个向量只存在 art_concepts.embedding JSON 里，sqlite-vec 索引从未生效
5. **patterns 和 references 从未生成过向量**

## 设计目标

- 三个搜索 tool 统一使用 sqlite-vec MATCH 查询
- 向量只存 vec0 表（单点真相），不再双存储
- 为 patterns 和 references 也生成向量
- 保留已有 43,433 个 concept 向量，从 JSON 迁移到 vec0
- 使用 Drizzle migration 管理 schema 变更

## 变更详情

### 1. DDL Migration（`drizzle/0014_vector_search.sql`）

```sql
DROP TABLE IF EXISTS vec_concepts;

CREATE VIRTUAL TABLE vec_concepts USING vec0(
  id TEXT,
  embedding float[1536]
);

CREATE VIRTUAL TABLE vec_patterns USING vec0(
  id TEXT,
  embedding float[1536]
);

CREATE VIRTUAL TABLE vec_references USING vec0(
  id TEXT,
  embedding float[1536]
);
```

### 2. 数据迁移（`db/index.ts` 启动时执行）

检测条件：vec_concepts 为空 且 art_concepts 有 embedding。
逻辑：读取 JSON embedding → Float32Array → Buffer blob → INSERT INTO vec_concepts。
标记完成状态到 sync_state 表。

43,433 条本地操作，预计几秒完成。art_concepts.embedding 列不删不清空，作为备份。

### 3. `embed-all.ts` 重写

- 统一为 concepts / patterns / references 三个表生成向量
- 只写入 vec0（不再写 art_concepts.embedding JSON）
- Preparestatement 提到循环外
- 加事务保护

### 4. 三个搜索 Tool 重写（`tools.ts`）

统一模式：
1. 生成 query embedding
2. Float32Array → Buffer blob
3. MATCH 查询 vec0 表
4. 回查业务表获取详情
5. 统一 score = 1 - distance，阈值 0.5，limit 8

### 5. API 端点（`/api/knowledge`）

语义搜索模式使用新的 vec_concepts 表查询。

### 6. `db/index.ts` vec0 表创建

移除旧的 vec_concepts 建表语句（改为由 migration 管理）。

## 不变更

- embedding 模型不变（openai/text-embedding-3-small，1536 维）
- OpenRouter API 调用方式不变
- art_concepts/art_patterns/art_references 表结构不变，embedding 列保留
- SSE 进度推送机制不变

## 涉及文件

| 文件 | 操作 |
|------|------|
| `drizzle/0014_vector_search.sql` | 新增 migration |
| `src/lib/server/db/index.ts` | 移除旧 vec0 建表 + 添加数据迁移 |
| `src/lib/server/knowledge/embed-all.ts` | 重写 |
| `src/lib/server/agent/tools.ts` | 重写 find_concepts / find_patterns / find_references |
| `src/routes/api/knowledge/+server.ts` | 适配新 vec0 查询 |

## 验证

1. 启动应用，确认日志显示数据迁移成功
2. 查询 `vec_concepts` 行数 = 43,433
3. 调用 `find_concepts` tool，验证返回有意义的结果
4. 生成 patterns / references 的向量，验证 `find_patterns` / `find_references` 返回结果
5. API `/api/knowledge?mode=semantic&search=xxx` 返回正确结果
