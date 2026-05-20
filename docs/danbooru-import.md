# Danbooru 标签库导入指引

## BigQuery 导出

1. 打开 [BigQuery 控制台](https://console.cloud.google.com/bigquery?project=danbooru1)
2. 依次执行 4 个 SQL 查询，每个查询完成后点「SAVE RESULTS → JSON (newline delimited)」

### Tags
```sql
SELECT id, name, post_count, category, created_at, updated_at, is_deprecated, words
FROM danbooru1.danbooru_public.tags
WHERE category = 0 AND is_deprecated = false
```

### Wiki Pages
```sql
SELECT id, title, body, other_names, is_locked, is_deleted, created_at, updated_at
FROM danbooru1.danbooru_public.wiki_pages
WHERE is_deleted = false AND body IS NOT NULL AND body != ''
```

### Tag Aliases
```sql
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_aliases
WHERE status = 'active'
```

### Tag Implications
```sql
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_implications
WHERE status = 'active'
```

## 导入流程

1. 将导出的 JSON 文件放入项目根目录的 `data/danbooru/` 目录下
2. 打开知识库管理页面（`/knowledge`）
3. 点击「导入标签」→ 等待完成（日志会显示导入数量）
4. 点击「生成向量」→ 等待完成（约 50k 条，需要几分钟）
5. 完成后 agent 即可使用 Danbooru 标签工具

## 更新数据

数据更新时重复上述步骤。导入会自动更新已有标签的描述和计数，新增缺失标签。
