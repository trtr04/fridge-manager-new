# Fridge Manager Supabase 初始化

这些 SQL 文件用于创建或补齐 Fridge Manager 所需的数据库结构，不会删除
`ingredients`、`preferences` 或 `auth.users` 中的现有数据。

## 运行前

1. 在 Supabase Dashboard 打开正确的项目。
2. 如果项目中已经有数据，先在 Dashboard 创建备份或导出两张业务表。
3. 打开 **SQL Editor → New query**。
4. 严格按照文件名顺序运行 `migrations/` 中的 SQL。
5. 每个文件都必须成功后，才能继续下一个。

顺序：

1. `202607300001_preflight.sql`
2. `202607300002_create_tables.sql`
3. `202607300003_create_triggers.sql`
4. `202607300004_enable_rls.sql`
5. `202607300005_verify_setup.sql`

预检只检查已有关键字段的类型，不修改数据。如果它报错，说明当前表和应用
需要的结构不兼容；不要跳过错误继续运行，也不要直接删除旧表。

## 创建后的表

### `public.ingredients`

一行代表一个真实库存批次。`id` 是 UUID，`user_id` 关联
`auth.users.id`。允许的存储区为：

- `fridge`
- `freezer`
- `pantry`
- `condiment`

### `public.preferences`

每个用户最多一行，主键 `id` 同时关联 `auth.users.id`。新用户注册时会自动
创建默认记录。

## 安全模型

- `anon` 无权读写两张表。
- `authenticated` 只获得必要的 CRUD 权限。
- RLS 强制登录用户只能访问属于自己的库存和偏好。
- 删除 Auth 用户时，其库存和偏好通过外键级联删除。

游客模式不访问 Supabase，只使用浏览器中以 `:guest` 结尾的 localStorage。

## 验证

最后一个脚本会检查：

- 表和关键字段是否存在且类型正确；
- 主键、外键、约束和索引是否存在；
- RLS 是否开启；
- 8 条 CRUD Policy 是否存在；
- 自动创建偏好的 Auth Trigger 是否存在；
- 是否有孤立数据或明显无效数据。

成功时 SQL Editor 会显示：

```text
Fridge Manager Supabase schema verification passed.
```

## Supabase CLI（可选）

如果项目已经通过 Supabase CLI link 到远端，可在仓库根目录运行：

```bash
supabase db push
```

CLI 会按照 migration 文件名顺序执行。第一次操作远端生产库前仍建议先在
Dashboard 备份。

