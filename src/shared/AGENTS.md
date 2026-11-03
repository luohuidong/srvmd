# AGENTS.md

本文件适用于 `src/shared`。先读仓库根 [AGENTS.md](../../AGENTS.md) 和 [ARCHITECTURE.md](../../ARCHITECTURE.md)。

## 职责

shared 只放跨端契约、领域类型和协议常量：

- `contracts`：Page API、错误 payload、app config
- `types`：`TocItem`、`Breadcrumb`、`MermaidSource`、`DirEntry`、`SiblingDocument` 等
- `constants`：内部路由、资源前缀、协议 token

shared 不依赖任何运行时，不读文件、不访问 DOM、不使用 Node 或浏览器 API。

只放两端都直接 import 的值。单端专用的逻辑和常量放对应运行时：面包屑构造在 `src/server/src/breadcrumbs.ts`，主题 storage key、配置元素 id 和 `ResolvedTheme` 在 `src/web/src/lib/`。

## 目录

```plaintext
src/shared/
  tsconfig.json
  tsconfig.build.json
  biome.json
  src/
    index.ts        唯一入口，按 namespace 导出
    constants.ts    协议常量和共享值
    contracts.ts    API/协议 payload
    types.ts        领域类型
```

`contracts.ts` 和 `types.ts` 保持分开：前者描述 API/协议 payload，后者描述领域类型。不要把两者合并。

## 导出规则

`index.ts` 只使用 namespace 导出：

```typescript
export * as constants from "./constants.js";
export type * as contracts from "./contracts.js";
export type * as types from "./types.js";
```

- 不要使用裸 `export * from`，避免不同文件的同名符号冲突。
- 运行时值只有 `constants` 一个 namespace。
- 类型通过 `contracts`、`types` 访问；server 消费者使用 `import type { contracts, types } from "../../shared/src/index.js"`（按目录深度调整）。
- web 消费者使用 `import { constants } from "@shared"` / `import type { contracts, types } from "@shared"`；`@shared` 是 Vite/TypeScript 构建别名，不是独立 package。
- 新增运行时文件时，在 `index.ts` 增加一行 `export * as <name> from ...`；新增类型时优先加到现有 `contracts.ts` 或 `types.ts`，不需要改 `index.ts`。

## 必须遵守

- 不导入 `node:*`、`bun:*`、DOM 类型或任何第三方运行时依赖。
- 不导入 `src/server`、`src/web`、`src/cli` 源码。
- 不使用 `process.`、`window.`、`document.querySelector` 等运行时全局。
- shared 的 import 必须只指向 shared 自身。
- 修改 API 字段时先改这里，再改 server 和 web，保持两端类型同步。
- 只放真正跨端的内容。只在 server 或只在 web 使用的类型、函数和常量不要放进 shared。

## 新增内容

### 新增页面字段

1. 在 `contracts.ts` 增加字段。
2. 在 server 的 `page-api.ts` 或 service 填充，并更新 ETag 字段。
3. 在 web 的对应组件渲染。
4. 补 server API 测试和 web 组件测试。

### 新增领域类型

1. 在 `types.ts` 增加类型。
2. 如果该类型属于 API payload，再在 `contracts.ts` 引用它。
3. 不需要改 `index.ts`，除非新建了模块文件。

### 新增协议常量

1. 在 `constants.ts` 增加常量。
2. 更新 server 的路由/资源路径或 web 的客户端逻辑。
3. 内部路由前缀属于 server 和 web 的共同契约，不要在两处各写一份字面量。
4. 如果只有一端 import（例如 shell 里由 server 替换的 token、Vite 的 `base`），要让另一端的字面量有测试守住，否则不要放进 shared。

### 新增模块文件

1. 在 `src/shared/src/` 增加文件。
2. 在 `index.ts` 增加 `export * as <namespace>` 或 `export type * as <namespace>`。
3. 更新本文件的目录表和根 [AGENTS.md](../../AGENTS.md) 的跨项目说明（如果有变化）。

## 测试

- shared 目前没有单独的测试文件；类型和导出由根 `pnpm run typecheck` 和 `tsc -p src/shared/tsconfig.json` 检查。
- runtime-free 主要由 `tsconfig` 保证（空的 `types`、无 DOM lib）；`test/architecture.test.ts` 只需兜住跨项目的相对 import。两层都不要为了通过检查而放宽。
- 修改 shared 后至少运行：

```bash
pnpm run build:node
pnpm run typecheck
pnpm run check
pnpm run test:node
```

## 构建与发布

- `src/shared/tsconfig.build.json` 输出到 `dist/shared/src`；`prepack` 由根 package 统一执行完整构建。
- 发布产物只包含 `dist`，不发布 `src`、测试或 AGENTS。
- `src/shared` 是 `srvmd` 的内部模块，不是独立 npm package；不要再恢复 `@srvmd/shared`。
- 版本升级只改根 `package.json`。
- 入口、namespace 或契约职责变化时更新本文件和 `ARCHITECTURE.md`。

## 代码风格

- 相对导入使用 `.js` 后缀；TypeScript 会把源码中的 `.js` 映射到 `.ts`，构建后的 `.d.ts` 也保持 `.js`。
- 代码注释用英文。
- 只使用 `export type` / `import type` 处理纯类型，保持 `verbatimModuleSyntax`。
- 常量保持 `UPPER_SNAKE_CASE`，类型保持 `PascalCase`，与现有文件一致。
