# 🧊 Fridge Manager / 冰箱托管

一个根据家庭现有食材管理库存、追踪保质期并推荐菜谱的中英文 Web 应用。

Fridge Manager 将食材划分为冷藏、冷冻、常温和调味料四个区域。用户可以在本地直接使用，也可以通过 Supabase 邮箱登录，在不同设备之间同步库存和饮食偏好。

## 功能

### 冰箱库存管理

- 四个存储区域：冷藏、冷冻、常温、调味料。
- 添加食材时记录名称、数量、单位、购买日期和保质期。
- 支持拖拽食材，并可选择只移动当前批次中的一部分。
- 增加库存时创建新的购买批次；同一天购买的同种食材会合并到当天的批次。
- 减少库存时优先消耗更早到期的批次。
- 移入冷冻区时保留原保质期，冷冻期间暂停倒计时。
- 冷冻食材移到冷藏区按解冻处理，从当天起重新计算 2 天保质期；移到常温或调味料区时，从当天起按食材自身保质期重新计算。
- 所有日期按用户所在时区的本地日期计算。
- 根据存储区域采用不同的排序和到期提示。

### 菜谱推荐

- 根据现有库存筛选和排列菜谱。
- 显示食材匹配率、综合推荐分数、难度、热量和预计时间。
- 支持烹饪速度、人数、心情、营养和饮食限制等偏好。
- 区分已有食材、缺少的主料和缺少的工具。
- 优先考虑即将到期的食材，帮助减少浪费。

推荐系统默认用户拥有以下基础调味料，因此它们不会计入食材拥有率，也不会降低菜谱匹配分数：

```text
油、盐、糖、醋、生抽、老抽、蚝油、黄酒、料酒、香油、
淀粉、水、味素、胡椒粉、白胡椒、黑胡椒、花椒、八角、
桂皮、香叶、葱、姜、蒜
```

例如，用户拥有鸡蛋时，一道需要“鸡蛋、油、盐”的菜谱会获得 100% 的食材匹配率；如果只有油和盐而没有鸡蛋，则不会获得高匹配率。

### 中英文切换

- 页面右上角提供 `EN / CN` 全局语言切换。
- 语言设置保存在浏览器中，刷新页面后仍会保留。
- 登录、偏好设置、食材管理、冰箱主页和推荐界面均支持中英文。
- 有英文来源的菜谱会显示英文标题、简介、原料、步骤和来源链接。

### 本地模式与云端同步

- 未登录时使用浏览器 `localStorage`，无需配置后端即可体验。
- 登录后使用 Supabase Auth 邮箱 Magic Link。
- 登录用户的库存和偏好保存到 Supabase。
- 每次同步只上传发生变化的食材，避免把其他设备已删除的食材重新写回云端。
- 离线修改会记录在本地，联网后再上传。
- Row Level Security 确保用户只能访问自己的数据。
- 游客数据和登录用户数据使用不同的本地存储空间。

## 菜谱数据来源

本项目的菜谱数据来源于开源项目：

- 中文菜谱：[Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook)
- 英文菜谱：[EuropaSuperman/HowToCookWithEnglish](https://github.com/EuropaSuperman/HowToCookWithEnglish)
- 英文翻译对应的上游提交：[HowToCook PR #1664](https://github.com/Anduin2017/HowToCook/pull/1664)

中文数据由仓库中的构建脚本解析为结构化 JSON，包括菜名、原料、步骤、分类、难度和推荐标签。

菜谱匹配使用的 `ingredientKeys` 由 `scripts/buildHowToCookDataset.js` 通过 `src/utils/ingredientNormalize.js` 生成。修改别名规则后需要重新生成数据，否则推荐结果不会更新。

英文数据来自 `HowToCookWithEnglish` 的 `a9f4489` 快照。当前项目映射了 323 道英文菜谱，并在英文界面中按需加载。由于英文翻译快照早于当前中文数据，部分后来新增的菜谱暂时没有对应英文内容；这类菜谱会显示明确提示，不会生成或伪造英文步骤。

英文来源内容为机器翻译，可能存在用词不自然、信息缺失或翻译错误。每张已映射的英文菜谱卡片都提供 `English source` 链接，方便核对原始文件。

HowToCook 使用 [The Unlicense](https://github.com/Anduin2017/HowToCook/blob/master/LICENSE)。菜谱来源、贡献者和内容许可归原项目声明管理。

## 技术栈

- React 18
- Vite 4
- Tailwind CSS
- dnd-kit
- Supabase Auth + PostgreSQL
- Vercel

## 本地运行

### 1. 安装依赖

建议使用 Node.js 18 或更高版本。

```bash
git clone https://github.com/trtr04/fridge-manager-new.git
cd fridge-manager-new
npm install
```

### 2. 配置环境变量

复制或新建根目录下的 `.env`：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

也可以使用新的 Supabase Publishable Key：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

如果没有配置 Supabase，应用不会崩溃，仍可使用本地模式。

不要把 `service_role` key 放入前端环境变量。前端只能使用 anon key 或 publishable key，并依靠 RLS 保护数据。

### 3. 启动开发服务器

```bash
npm run dev
```

Vite 默认地址通常为：

```text
http://localhost:5173
```

### 4. 运行测试

```bash
npm test
```

测试使用 Node 内置的 `node:test`，覆盖日期计算、库存批次、云端同步和菜谱忌口规则，不需要额外依赖。

### 5. 构建生产版本

```bash
npm run build
npm run preview
```

生产文件会生成到 `dist/`。

## Supabase 初始化

在 Supabase Dashboard 中打开项目，然后进入 **SQL Editor → New query**。严格按照以下顺序运行 SQL：

1. `supabase/migrations/202607300001_preflight.sql`
2. `supabase/migrations/202607300002_create_tables.sql`
3. `supabase/migrations/202607300003_create_triggers.sql`
4. `supabase/migrations/202607300004_enable_rls.sql`
5. `supabase/migrations/202607300005_verify_setup.sql`

最后一个脚本成功时会显示：

```text
Fridge Manager Supabase schema verification passed.
```

这些脚本会：

- 创建或补齐 `public.ingredients` 和 `public.preferences`。
- 添加主键、外键、字段约束和索引。
- 为新用户自动创建默认偏好。
- 启用 RLS。
- 创建用户级别的增删改查策略。
- 检查孤立数据和不兼容结构。

如果数据库已经存在数据，请先备份。预检脚本报错时不要跳过错误继续执行。

更完整的说明见 [`supabase/README.md`](supabase/README.md)。

### Supabase Auth 配置

使用邮箱 Magic Link 时，需要在 Supabase 的 Auth URL 配置中加入：

```text
http://localhost:5173
https://your-vercel-domain.vercel.app
```

生产环境更换 Vercel 域名后，也要同步更新 Supabase 的 Site URL 和允许的 Redirect URL。

## Vercel 部署

1. 在 Vercel 中导入现有 GitHub repository。
2. Production Branch 选择 `main`。
3. Framework Preset 选择 `Vite`；如果界面没有 Vite，可选择 `Other`。
4. Build Command 设置为：

   ```text
   npm run build
   ```

5. Output Directory 设置为：

   ```text
   dist
   ```

6. 在 Vercel 项目的环境变量中添加：

   ```text
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   ```

   或使用：

   ```text
   VITE_SUPABASE_PUBLISHABLE_KEY
   ```

7. 重新部署。

Vercel 连接 `main` 后，后续推送通常会自动触发新的生产部署。

## 菜谱数据构建

正常开发和部署不需要重新生成菜谱 JSON，生成结果已经提交到仓库。

### 重新生成中文菜谱

将 HowToCook 仓库放在：

```text
data/howtocook/
```

然后运行：

```bash
npm run build:recipes
```

输出文件：

```text
src/data/howToCookRecipes.json
```

### 重新导入英文菜谱

英文导入脚本需要 `HowToCookWithEnglish` 的 `translation/en/dishes` 目录：

```bash
npm run build:recipes:en -- /path/to/HowToCookWithEnglish/translation/en/dishes
```

相关文件：

- `scripts/importHowToCookEnglish.js`：解析英文 Markdown。
- `scripts/howToCookEnglishMap.json`：中文菜谱 ID 与英文文件的映射及来源版本。
- `src/data/howToCookEnglish.json`：供前端按需加载的英文菜谱数据。

## 项目结构

```text
fridge-manager-new/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── LandingPage.jsx
│   │   ├── PreferencesPage.jsx
│   │   ├── IngredientsPage.jsx
│   │   ├── MainPage.jsx
│   │   ├── FridgePanel.jsx
│   │   ├── IngredientCard.jsx
│   │   ├── RecipePanel.jsx
│   │   └── LanguageToggle.jsx
│   ├── config/
│   │   └── supabaseClient.js
│   ├── data/
│   │   ├── howToCookRecipes.json
│   │   └── howToCookEnglish.json
│   ├── hooks/
│   │   └── useIngredients.js
│   ├── i18n/
│   │   ├── LanguageContext.jsx
│   │   └── contentTranslations.js
│   └── utils/
│       ├── dateUtils.js
│       ├── ingredientIds.js
│       ├── ingredientNormalize.js
│       ├── ingredientValidation.js
│       ├── inventory.js          # 批次、加减、移动等库存规则
│       ├── recipeMatching.js
│       ├── syncState.js          # 云端同步的变更追踪
│       ├── templates.js
│       └── userData.js
├── tests/
│   ├── inventory.test.js
│   ├── recipeMatching.test.js
│   └── syncState.test.js
├── scripts/
│   ├── buildHowToCookDataset.js
│   ├── importHowToCookEnglish.js
│   └── howToCookEnglishMap.json
├── supabase/
│   ├── README.md
│   └── migrations/
├── package.json
└── README.md
```

## 当前限制

- 菜谱匹配目前主要基于规范化后的食材名称，不计算精确用量。
- 推荐菜谱不会自动扣减库存。
- 英文菜谱来自机器翻译快照，质量取决于来源文件。
- 中文主仓库后来新增的部分菜谱暂时没有英文版本。
- 多设备同时修改同一项食材时，以最后上传的修改为准；其他设备需要刷新页面才能看到最新数据。
- 提交前建议执行 `npm test` 和 `npm run build`（GitHub Actions 也会自动运行）。

## 数据与隐私

- 游客数据只保存在当前浏览器。
- 登录用户的数据存储在配置的 Supabase 项目中。
- 应用不需要 Supabase `service_role` key。
- 数据隔离依赖 Supabase RLS，请勿跳过对应 migration。

---

菜谱内容感谢 [Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook) 及其社区贡献者。
