# AGENTS.md

本文件适用于 `src/web`。先读仓库根 [AGENTS.md](../../AGENTS.md) 和 [ARCHITECTURE.md](../../ARCHITECTURE.md)。

## 职责

web 是浏览器运行时和全部 UI：

- Svelte 5 页面、组件和交互
- 根据 `location.pathname` 请求 `/__api/page/<path>`
- 文档页、目录页、错误页、加载态
- 主题切换、Mermaid 图表和查看器
- live reload 的条件重取
- 静态 HTML 的 live reload（正式模式预构建，开发模式由 Vite 提供）
- 首屏前的主题初始化

web 不读文件系统，不解析 Markdown，不判断 URL 对应的资源类型。

## 目录

```plaintext
src/web/
  biome.json            Biome 配置：继承根配置，排除 .svelte
  .prettierrc.json      Prettier + prettier-plugin-svelte 配置
  index.html            应用壳
  src/main.ts           Svelte mount
  src/App.svelte        加载 page payload，切换视图
  src/features/         document、directory、mermaid、theme、live、error
  src/components/       跨 feature 的展示组件
  src/lib/              API client、constants、types、formatting
  src/live-static.ts    静态 HTML 的预构建 live reload
  src/styles/           app、markdown、mermaid CSS
  src/test/setup.ts     Vitest/jsdom setup
  public/theme-boot.js  首屏前执行的主题初始化
  vite.config.ts        Vite dev server + build
  vitest.config.ts      Vitest/jsdom 配置
```

Vite 的 `root` 是 `src/web`，构建输出是仓库根的 `dist/web`。

## 必须遵守

- 保持 server-routed CSR。页面由服务器返回壳，`App.svelte` 根据 `location.pathname` 请求页面数据；不要添加前端 router、History API 拦截或 `<a>` 链接拦截。
- 不导入 `src/cli`、`src/server`、`node:*` 或使用 Node 全局。只依赖 `@shared`、自身代码和浏览器端依赖。
- 页面结构只在 Svelte 中。服务端 `html` 字段是 Markdown 内容，不是整页 HTML。
- 新页面不插入内联客户端 JS。主题初始化使用阻塞脚本 `public/theme-boot.js`；静态 HTML live reload 使用预构建的 `src/live-static.ts`。
- 不要用 `{@html}` 插入未受信任内容。合法边界只有 Markdown 正文和 Mermaid SVG。
- Mermaid 只从服务端 slot + sources 渲染。`src/features/mermaid/slots.ts` 是唯一把 Svelte 组件挂载到 `{@html}` slot 的位置。
- Mermaid 每次渲染必须使用唯一 id；不要缓存 SVG 后在 inline 图和 viewer 中复用。`bindFunctions` 必须在 SVG 插入后调用。
- 主题偏好（`light` / `dark` / `system`）持久化到 `src/lib/constants.ts` 的 `THEME_STORAGE_KEY`，解析后的 `light` / `dark` 写入 `document.documentElement.dataset.theme`；`system` 通过 `matchMedia` 跟随系统并监听变化。不要另建主题系统。该 key 必须和 `public/theme-boot.js` 一致，`src/lib/assets.test.ts` 会校验。
- 组件私有样式写在对应 `.svelte` 的 `<style>` 中；可复用的布局或控件应抽成组件（如 `PageLayout`、`Button`），不要用全局 class 在组件之间复用。`src/styles/app.css` 只保留主题变量和基础元素样式；`markdown.css` 保留服务端 Markdown HTML 的全局样式；`mermaid.css` 只保留服务端生成的 `.mermaid-slot`。`MermaidDiagram`、`MermaidViewer` 的样式在各自组件内，`{@html}` 插入的 SVG 用 `:global(...)`。
- live reload 的条件重取：目录页对子树变更敏感，文档页对自身源文件、同目录 Markdown（左侧文档列表）和 CSS 变更敏感；CSS 变更整页 reload，304 时保留当前状态。
- `dist/web` 是生成产物，不要手改。

## shared 导入约定

只从 `@shared` 单一入口导入 namespace：

```typescript
import { constants } from "@shared";
import type { contracts, types } from "@shared";

const livePath = constants.LIVE_PATH;
type Page = contracts.PagePayload;
type Toc = types.TocItem;
```

- 不要从 `@shared/contracts` 之类的子路径导入。
- Vite 和 Vitest 使用精确 alias `/^@shared$/` 指向 `src/shared/src/index.ts`；不要改成字符串前缀 alias。
- `$lib` 指向 `src/web/src/lib`；其他内部模块使用相对导入。
- `src/lib/constants.ts` 放只属于浏览器的常量（配置元素 id、主题 storage key），并让 `src/lib/assets.test.ts` 校验它们与 `index.html` / `public/theme-boot.js` 的字面量一致；`src/lib/types.ts` 放 `ThemePreference`、`ResolvedTheme` 这类浏览器专用类型。

## 命令

```bash
pnpm run build:web
pnpm run dev:web
pnpm run test:web
pnpm run test:watch:web
pnpm run typecheck
pnpm run check
pnpm run check:fix
pnpm run check:svelte
pnpm run format:svelte
```

`build:web` 输出到 `dist/web`，随根 `srvmd` package 发布；`dev:web` 启动 Vite 开发服务器，srvmd 通过 `SRVMD_DEV_WEB_URL` 代理它的 shell 和 `/__app/*`。

开发端口固定 `5180`，同时用于 `server.port` 和 `server.ws.clientPort`；HMR WebSocket 由浏览器直连 Vite，不经过 srvmd。根 `dev:node` 脚本写死了 `SRVMD_DEV_WEB_URL=http://localhost:5180`，Vite 配置也默认使用 5180；改端口时两处要一起改。`strictPort` 保证端口被占用时直接失败，避免 HMR 连到错误的进程。

`check` 是 `biome check .` 加 `prettier --check "src/web/**/*.svelte"`。

- TS/JSON/CSS/HTML 的范围由 `src/web/biome.json` 决定，它显式排除 `.svelte`。
- `.svelte` 由 `src/web/.prettierrc.json`（`prettier` + `prettier-plugin-svelte`）负责；Prettier 依赖在根 package，根 `check` 通过 `check:svelte` / `format:svelte` 转调。
- `check:svelte` 只做检查，`format:svelte` 只写 `.svelte`；不要用 Prettier 处理 TS/JSON/CSS。

## 新增功能

### 新增交互控件或页面

1. 在 `src/features/<feature>/` 放组件和客户端逻辑。
2. 需要服务端数据时，先在 [src/shared/AGENTS.md](../shared/AGENTS.md) 增加契约，再由 server 填充。
3. 在 `src/App.svelte` 或对应 feature 组件中使用数据。
4. 补 `src/**/*.test.ts`。
5. 跨 feature 的展示组件放 `src/components/`，不要把请求逻辑放进去。

### 消费新的页面字段

1. 确认 shared 契约和 server payload 已更新。
2. 在对应 Svelte 组件渲染。
3. 补组件测试；需要时补 App 级测试。
4. 不要在 web 中解析 Markdown 或重新计算 TOC。

### 新增页面类型

1. 在 `src/App.svelte` 的 state 和分支中增加视图。
2. 在 `src/features/` 增加页面组件。
3. server 侧 Resource、routes 和 payload 按 [src/server/AGENTS.md](../server/AGENTS.md) 完成。
4. 补 App 测试和页面组件测试。

### 修改 Mermaid

- `load.ts`：加载 `/__serve_md_mermaid.js`
- `render.ts`：初始化主题、串行渲染、生成唯一 id
- `slots.ts`：把 Svelte 组件挂载到 server slot
- `viewport.ts` / `viewer.svelte.ts`：缩放、拖拽、Fit、打开/关闭
- `MermaidDiagram.svelte` / `MermaidViewer.svelte`：展示和交互

组件测试要 mock `./render.ts`，不要加载真实 Mermaid runtime。

## 测试

- 用 Vitest + Testing Library + jsdom，测试与源码 colocate 在 `src/**/*.test.ts`。
- Vitest 配置使用 `src/web/vitest.config.ts`；`src/test/setup.ts` 提供 dialog polyfill，不要绕过 setup。
- App 测试通常 mock `$lib/api` 或 live client，避免真实网络和 WebSocket。
- Mermaid 测试 mock `render.ts`，只验证 slot 挂载、状态、交互和 SVG 插入；不要加载真实 Mermaid。
- 修改主题、live reload、Mermaid viewer 或静态资源时，补对应 Vitest 用例；根 Vitest 配置不覆盖浏览器运行时。
- 根 `pnpm test` 会额外跑 `src/web`；只跑 web 用 `pnpm run test:web`。

## 构建与发布

- Vite 有两个入口：`index.html` 和 `src/live-static.ts`。后者固定输出 `dist/web/live-static.js`。
- `public/theme-boot.js` 会被复制到 `dist/web/theme-boot.js`；它必须在 `<head>` 中阻塞执行。
- Vite `base` 是 `/__app/`，`root` 是 `src/web`，`outDir` 是 `../../dist/web`；入口文件名和 chunk 命名规则不要随意改。
- 开发模式下 Vite 仍然使用 `/__app/` base；`vite.config.ts` 的 `server.ws.clientPort` 必须和 `server.port` 一致，否则 HMR client 会连到 srvmd 端口。
- 开发模式默认只监听 localhost；暂时不支持 LAN 上开发 UI，需要时再显式配置 `server.host` 和 `allowedHosts`。
- 新增客户端入口时，同时更新 `vite.config.ts`、server 的 `assets/` 或 shared 的常量路径。
- 根 package 的 `files` 包含 `dist`，因此 `dist/web` 会随 `srvmd` 发布；不发布 `src/web` 源码。
- 根 `prepack` 执行完整构建，再用 `src/web/scripts/verify-dist.ts` 校验 `dist/web` 完整；不要恢复独立 web package。
- `.svelte` 格式由 Prettier 负责；TS/JSON/CSS 由 Biome 负责，二者不要混用。
- 构建产物、开发命令或浏览器边界变化时更新根 README。

## 代码风格

- `.svelte` 用 `src/web/.prettierrc.json` 里的 Prettier + `prettier-plugin-svelte`；TS/JSON/CSS 用 `src/web/biome.json` 的 Biome。不要用 Biome 格式化 `.svelte`，也不要把 Prettier 用到 TS/JSON/CSS。
- 类型导入使用 `import type`；shared 类型使用 namespace（`contracts.*`、`types.*`）。
- 代码注释用英文。
- Svelte 5 使用 runes（`$state`、`$derived`、`$props`），跟随现有组件写法。
- 保持模块聚焦：Mermaid 的 `load/render/viewport/viewer/diagram` 是参照。
