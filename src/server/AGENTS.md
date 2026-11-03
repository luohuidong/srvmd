# AGENTS.md

本文件适用于 `src/server`。先读仓库根 [AGENTS.md](../../AGENTS.md)、[ARCHITECTURE.md](../../ARCHITECTURE.md) 和 CLI 说明 [src/cli/AGENTS.md](../cli/AGENTS.md)。

## 职责

server 是 `srvmd` 的 Node 运行时，负责：

- `node:http` + `ws` 组装和请求分发
- URL 到安全文件系统资源的解析
- HTTP 语义：headers、ETag、304、Range/If-Range、301
- Markdown 渲染、TOC、shiki、Mermaid sources
- 目录列表、文档缓存
- 文件监听和 WebSocket live reload
- `/__app/*` 静态资源和 Mermaid 浏览器运行时；开发模式下 `/__app/*` 代理到 Vite dev server

server 不拼页面 HTML，不访问 DOM，不导入 CLI 或 web 源码。CLI 只通过
`src/server/src/index.ts` 的 `startServer` 使用 server。

## 目录

```plaintext
src/server/
  tsconfig.json
  tsconfig.build.json
  biome.json
  vitest.config.ts
  src/
    index.ts           入口，导出 startServer、ServerOptions
    config.ts          ServerOptions -> ResolvedConfig
    constants.ts       服务端常量
    context.ts         高亮器、文档缓存、live 等长生命周期服务
    create-server.ts   node:http + ws 组装
    assert.ts          封闭 union 的穷尽检查
    fs-path.ts         路径安全辅助与 ResolvedPath
    breadcrumbs.ts     root -> ... -> directory 面包屑构造
    file-kinds.ts      扩展名分类
    http/              Response/ETag/304 原语
    routes/            URL -> handler 编排（page-api、shell、static-html）
    resolve/           URL -> 安全 Resource
    services/          documents、directories、live
    markdown/          Markdown -> HTML/TOC/Mermaid sources
    assets/            web 资源（dist 文件或 Vite dev 代理）、shell 缓存、Mermaid runtime
  test/                路径 / resolve / 目录单测 fixture 和 API/routing fixture
```

## 必须遵守

- 只使用 Node API；不要使用 `window`、`document.querySelector` 等 DOM 全局，也不要导入 Svelte。
- 不导入 `src/cli`、`src/web` 或 `src/web/src/*`。web 只通过 `config.web` 访问：`dist` 读取 `dist/web` 目录，`dev` 代理 Vite URL。两种模式都不导入 web 源码。
- CLI 只能从 `src/server/src/index.ts` 导入；不要给 CLI 暴露深层模块。`index.ts` 只导出实际被 CLI 使用的符号。
- `startServer` 只接受 `ServerOptions`，所有字段必填；`web` 由 CLI 解析并传入。不要在 server 里猜测 web 构建产物或 dev server 的位置。
- 监听地址固定为 `0.0.0.0`，在 `create-server.ts` 里写死；`ServerOptions` 不包含 `hostname`。没有 `--host` 参数；要加就先加 CLI 参数，再把字段加回契约。
- `resolveConfig` 只接受 `ServerOptions` 并做校验/归一化；默认值在 CLI 的 `toServerOptions` 里。不要恢复 `DEFAULT_WEB_ROOT` 或 `= {}` 默认参数。
- API 路径只解码一次：`resolveRequest` 负责 `decodeURIComponent`、空字节、隐藏路径和 symlink 越界检查；调用链里不要再解码。
- `IGNORED_NAMES` 由 watcher、目录列表和 `resolveRequest` 共用；按相对 root 的路径段匹配，直接请求也返回 404。`--ignore` 只影响 watcher，不改变访问语义。
- `DocumentStore.get()` 在源文件消失（`ENOENT` / `ENOTDIR`，包括 `stat` 与读取之间的删除竞态）时返回 `null`；页面 API 必须映射为 404，不要恢复未捕获的 `stat`。
- shell 原样返回 Svelte 模板，不拼页面结构、head 或脚本标签。壳缺失时返回 503：dist 模式提示实际的 `dist/web/index.html` 路径，dev 模式提示 Vite URL。
- 静态 HTML 原样服务；总是注入外部 live-reload 脚本（超过 `MAX_HTML_INJECTION_BYTES` 时跳过）。dist 模式注入 `/__app/live-static.js`，dev 模式注入 Vite 的 `/__app/src/live-static.ts`。
- Mermaid 只输出 `<div data-mermaid-slot="...">` 占位和结构化 sources，不生成 figure HTML；浏览器运行时从本地 `mermaid` 依赖解析。
- Markdown 由 `markdown/markdown.ts` 的 markdown-it 实例渲染：标题 id/TOC、任务列表、Mermaid slot、shiki fence 都是 token 规则。不要重新引入对渲染后 HTML 的正则后处理，也不要依赖某个 runtime 的 Markdown 输出形状。
- 页面数据字段变化时同步更新 `routes/page-api.ts` 的 `documentEtag` / `directoryEtag`，否则条件请求会返回过期 304。
- live 事件先 `documents.invalidate()` 再广播；只有 Markdown 路径进入文档缓存。
- 保留内部路由前缀：`/__api/page/*`、`/__app/*`、`/__serve_md_live`、`/__serve_md_mermaid.js`。

## 配置流

```plaintext
CLI defaults -> ServerOptions
  -> resolveConfig()
  -> ResolvedConfig
  -> createWebAssets()
  -> createContext()
  -> createRequestHandler()
```

- `config.ts` 负责校验、归一化和 `ResolvedConfig`；用户默认值由 CLI 的 `toServerOptions` 提供，版本号来自根 `package.json`。
- `create-server.ts` 负责创建 `node:http` server、挂载 `ws` WebSocket、转换 Fetch Request/Response，以及 `close()` 时释放 context。
- `context.ts` 持有 highlighter、renderer、document store、web assets 和 live；不要在请求处理里重复创建这些对象。
- `assets/index.ts` 的 `createWebAssets()` 按 `config.web.kind` 选择实现：`dist` 读文件并缓存 shell，`dev` 每次向 Vite 取 shell 并代理 `/__app/*`。
- `src/server/src/index.ts` 是入口；新增导出要加在这里，不要把内部模块暴露给 CLI。

## 命令

```bash
pnpm run build:node                       # 构建 shared/server/cli 到 dist
pnpm run build:web                        # dist 模式先构建 dist/web
pnpm run dev:web                          # dev 模式先启动 Vite
pnpm run dev:node ./example/docs
pnpm run test:server                      # 只跑 src/server 的 Vitest
pnpm test                                 # 完整测试
pnpm run typecheck
pnpm run check
pnpm run check:fix
```

## 新增功能

### 新增 server/CLI 配置

1. 在 `config.ts` 的 `ServerOptions` 增加必填字段；如果字段有用户默认值，在 CLI 的 `toServerOptions` 里提供。
2. 在 `resolveConfig` 校验并写入 `ResolvedConfig`。
3. 在消费该配置的模块使用。
4. 如果要暴露成 CLI 参数，按 [src/cli/AGENTS.md](../cli/AGENTS.md) 的流程改 CLI。
5. 补行为测试；影响 HTTP 输出时同时检查 page API 和 routing 测试。

### 新增页面字段

1. 先在 [src/shared/AGENTS.md](../shared/AGENTS.md) 的 `contracts.ts` 增加字段。
2. 在 `routes/page-api.ts` 或对应 service 填充。
3. 更新 `documentEtag` / `directoryEtag`。
4. 补 `routes/page-api.test.ts`；影响 HTTP 输出时再补 `routes/routing.test.ts`。
5. 浏览器侧的渲染在 [src/web/AGENTS.md](../web/AGENTS.md) 中完成。

### 新增页面类型

1. 在 `resolve/resource.ts` 定义新的 Resource。
2. 在 `routes/index.ts` 分派，并在 `routes/` 增加 handler。
3. 在 shared 增加 payload 契约（见 [src/shared/AGENTS.md](../shared/AGENTS.md)）。
4. 补 server API 测试和 routing 测试。
5. 在 web 的 `App.svelte` 增加视图切换和组件。

### 新增 Markdown 语法

1. 只改 `markdown/` 下的解析/渲染模块。
2. 如果产生交互占位，只在 HTML 中输出占位，并把数据放进 shared 契约。
3. 在 server 测试中覆盖渲染结果；交互组件由 web 负责。
4. Markdown 永远在服务端渲染，不要把 parser 或 shiki 移进浏览器。

### 新增文件类型或路由

1. 在 `file-kinds.ts` / `resolve/` 判断文件类型和解析 Resource。
2. 在 `routes/index.ts` 编排响应。
3. 不要在 web 中判断文件系统类型。
4. 补 resolve/request 测试和 routing 测试。

## 测试

- 用 Vitest，测试与源码 colocate 在 `src/server/src/**/*.test.ts`。
- 路径、resolve、目录纯函数测试使用 `src/server/test/fixture.ts` 的 `createFixture()`；它通过 `onTestFinished` 自动清理，必须在 `test` 内调用，不要在 `beforeAll` 里创建。
- page API 和 routing 集成测试使用 `src/server/test/server-fixture.ts` 的 `createServerFixture()`；它同时提供临时内容目录和最小 Svelte 壳。
- 按层放测试：`routes/routing.test.ts` 覆盖 shell、静态资源、路径安全、Range/If-Range、405/重定向和 live WebSocket；`routes/page-api.test.ts` 只覆盖 payload 语义和条件请求。不要在两处重复断言同一行为。
- `assets/dev.test.ts` 用 `test/http-fixture.ts` 的真实 `node:http` server 模拟 Vite，覆盖 dev shell、`/__app/*` 代理、query 保留、路径安全和 Vite 不可用；`config.test.ts` 覆盖 `web` union 和 dev URL 校验。
- 涉及 watcher、LiveReload 或文件系统事件时，保留真实 fs 和必要的等待时间，不要用固定 sleep 替代事件等待。
- `src/server/tsconfig.json` 包含 `src/**/*.ts` 和 `test/**/*.ts`，fixture 也必须通过类型检查。

## 构建与发布

- `src/server/tsconfig.build.json` 输出到 `dist/server/src`；`prepack` 由根 package 统一执行完整构建。
- 发布产物只包含 `dist`，不发布 `src`、测试 fixture 或 AGENTS。
- shared 是同一 package 的 `src/shared`，通过相对导入 `../../shared/src/index.js` 使用；不要再引入 `@srvmd/shared`。
- 版本号来自根 `package.json`。

## 代码风格

- 相对导入使用 `.js` 后缀；TypeScript 会把源码中的 `.js` 映射到 `.ts`，构建后的 `.d.ts` 也保持 `.js`。
- 代码注释用英文。
- 一个文件只承担一类职责：`http/` 不渲染 Markdown，`resolve/` 不拼响应，`markdown/` 不碰页面壳。
- 模块聚焦的参照是 `markdown/`、`resolve/`、`services/live/` 的现有拆分。
- 不要用 `{@html}` 或字符串 HTML 拼页面；页面结构属于 web。
