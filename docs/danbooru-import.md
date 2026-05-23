# Danbooru 标签库导入指引

## BigQuery 导出操作

数据源：BigQuery 公开数据集 `danbooru1.danbooru_public`（每日更新）。

### 操作步骤

1. 打开 [BigQuery 控制台](https://console.cloud.google.com/bigquery?project=danbooru1)
2. 确认左侧资源面板中能看到 `danbooru1` → `danbooru_public` 数据集（如没有，点击「ADD DATA → Pin a project → 输入 `danbooru1`」）
3. 在查询编辑器中粘贴下方 SQL 并执行
4. 结果出现后，点击上方 **SAVE RESULTS** → **JSON (newline delimited)**
5. 文件保存到 `data/danbooru/` 目录，文件名必须包含对应关键词（见每个查询后的命名要求）

### 1. Tags（标签基础数据）

```sql
SELECT id, name, post_count, category, created_at, updated_at, is_deprecated, words
FROM danbooru1.danbooru_public.tags
WHERE category = 0 AND is_deprecated = false
```

- 保存为 `data/danbooru/tags.json`
- 约 48 万行，导出可能需要 1-2 分钟

### 2. Wiki Pages（标签描述）

```sql
SELECT id, title, body, other_names, is_locked, is_deleted, created_at, updated_at
FROM danbooru1.danbooru_public.wiki_pages
WHERE is_deleted = false AND body IS NOT NULL AND body != ''
```

- 保存为 `data/danbooru/wiki_pages.json`
- 约 20 万行

### 3. Tag Aliases（标签别名）⚠️ 必须导出

别名用于搜索时归一化——用户输入 "backlight" 时自动映射到正式标签 "backlighting"。没有这份数据，语义搜索会漏掉大量同义词匹配。

```sql
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_aliases
WHERE status = 'active'
```

- 保存为 `data/danbooru/tag_aliases.json`（文件名必须包含 `alias`）
- 约 1.5 万行

### 4. Tag Implications（标签推论关系）⚠️ 必须导出

推论关系表示"有 A 就一定有 B"——例如 `backlighting` 隐含 `lighting`。搜索时返回匹配标签的推论标签作为"相关推荐"，帮助 AI 一次性获得完整的标签上下文。

```sql
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_implications
WHERE status = 'active'
```

- 保存为 `data/danbooru/tag_implications.json`（文件名必须包含 `implication`）
- 约 4 万行

### 文件命名规则

导入程序按文件名中的关键词匹配：

| 数据 | 文件名需包含 | 示例 |
|------|------------|------|
| Tags | `tags` | `tags.json` |
| Wiki Pages | `wiki` | `wiki_pages.json` |
| Aliases | `alias` | `tag_aliases.json` |
| Implications | `implication` | `tag_implications.json` |

### BigQuery 导出注意事项

- BigQuery 免费额度每月 1 TB，这四个查询总量约 5 GB，远在额度内
- `SAVE RESULTS → JSON (newline delimited)` 会直接下载 JSONL 格式文件，无需格式转换
- 如果浏览器下载中断，可以用 `bq` 命令行工具导出到 GCS 再下载：
  ```bash
  bq query --destination_table=myproject:exports.tags \
    'SELECT id, name, post_count, category, created_at, updated_at, is_deprecated, words FROM danbooru1.danbooru_public.tags WHERE category = 0 AND is_deprecated = false'
  bq extract --destination_format=NEWLINE_DELIMITED_JSON myproject:exports.tags gs://my-bucket/danbooru/tags.json
  ```
- 数据集每日更新，建议每月重新导出一次以获取最新标签数据

## 导入流程

1. 将 4 个导出的 JSON 文件放入项目根目录的 `data/danbooru/` 目录下
2. 打开知识库管理页面（`/knowledge`）
3. 点击「导入标签」→ 等待完成（日志会显示导入数量）
4. 点击「生成向量」→ 等待完成（约 50k 条，需要几分钟）
5. 完成后 agent 即可使用 Danbooru 标签工具

导入程序会自动：
- Tags + Wiki Pages 做 join（仅保留两者都有的标签），upsert 到 `danbooru_tags`
- Aliases 清空旧数据后全量写入 `danbooru_tag_aliases`
- Implications 清空旧数据后全量写入 `danbooru_tag_implications`

## 更新数据

数据更新时重复上述步骤。导入会自动更新已有标签的描述和计数，新增缺失标签，并全量刷新 aliases 和 implications。

## 验证

导入完成后，检查各表记录数：

```sql
SELECT 'tags' AS table_name, COUNT(*) FROM danbooru_tags
UNION ALL SELECT 'aliases', COUNT(*) FROM danbooru_tag_aliases
UNION ALL SELECT 'implications', COUNT(*) FROM danbooru_tag_implications;
```

预期结果：
- tags: ~50,000
- aliases: ~15,000
- implications: ~40,000
