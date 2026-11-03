# AGENTS.md

本文件适用于 `src/cli`。先读仓库根 [AGENTS.md](../../AGENTS.md)、[ARCHITECTURE.md](../../ARCHITECTURE.md) 和 server 说明 [src/server/AGENTS.md](../server/AGENTS.md)。

## 职责

CLI 是进程边界，只负责：

- Commander 参数解析和校验
- 调用 `src/server` 的 `startServer` 启动服务器
- 定位 `dist/web`（web 构建产物，随同一个 package 发布）
- 启动输出、`--open`、信号和进程生命周期

CLI 不承载 HTTP、Markdown、目录、live reload 或页面结构逻辑。需要这些能力时改 `src/server`。

## 关键文件

| `src/` 下的文件 | 职责 |
| --- | --- |
| `index.ts` | bin 入口；统一错误输出：`srvmd: <message>` 写 stderr 后退出码 1 |
| `command.ts` | Commander 定义、action、启动参数合并 |
| `options.ts` | `RawCliOptions` -> `ServerOptions`（不含 `web`），并集中 CLI 默认值 |
| `web-source.ts` | 根据 `SRVMD_DEV_WEB_URL` 选择 Vite dev URL 或解析 `dist/web` |
| `lifecycle.ts` | 信号处理 |
| `report.ts` | 启动报告和局域网地址 |
| `browser.ts` | `--open` 的 best-effort 浏览器启动 |
| `which.ts` | 模拟 `which`：按 PATH / PATHEXT 查找可执行文件 |

## 必须遵守

- 只从 `../../server/src/index.js` 导入 `startServer`、`ServerOptions`；不要导入 server 内部模块。
- 不直接导入 shared 源码；CLI 需要的类型通过 server 入口获取。
- 不导入 web 源码或 `src/web/src/*`。web 只通过 `dist/web` 中的静态文件被 server 提供。
- 正式模式用 `new URL("../../../dist/web", import.meta.url)` 定位构建产物，再拼出 `index.html`；不要写死 `node_modules` 路径，也不要用 CWD 相对路径。
- `resolveWebSource` 在 `SRVMD_DEV_WEB_URL` 存在时直接返回 `{ kind: "dev", url }`，不要求 `dist/web` 存在；否则检查 `dist/web/index.html`。
- `resolveWebSource` 的 dist 分支错误信息不要带 `srvmd:` 前缀，`index.ts` 会统一添加。缺少产物时只报告缺什么和预期路径，不要提示构建或重装。
- `startServer` 成功后立即安装生命周期处理器；`--open` 可能阻塞，不能挡在安装处理器之前。
- `shutdown` 先 `running.close()`，再 `process.exit(0)`；重复信号只生效一次。
- `srvmd --version` 读取根 `../../../package.json`，不要新增 `ServerOptions.version` 覆盖参数。
- 内容目录相对当前工作目录。仓库内启动时通常写 `./example/docs`。

## 进程生命周期

| 触发 | 机制 |
| --- | --- |
| `Ctrl+C`、`SIGTERM`、`SIGHUP` | 信号处理器，覆盖继承来的 `SIG_IGN` |

- 不追踪父进程，也不轮询终端：启动者退出、或进程被 `disown`/`setsid` 脱离终端后，服务继续运行，用 `kill` 结束。
- 修改生命周期逻辑时保留三个信号最终都走同一个 `shutdown` 的结构。

## 命令

```bash
pnpm run build:node                    # 构建 shared/server/cli 到 dist
pnpm run build:web                     # 正式模式还需要 dist/web
pnpm run preview ./example/docs      # 启动编译产物（需先 build）
pnpm run dev:web                       # 开发 UI：另一个终端运行
pnpm run dev:node ./example/docs
node dist/cli/src/index.js --version
pnpm run test:cli                      # 只跑 src/cli 的 Vitest
pnpm test                              # 完整测试
```

## 新增 CLI 参数

1. 在 `command.ts` 声明参数和帮助文本。
2. 在 `options.ts` 的 `RawCliOptions` 增加字段，映射到 `ServerOptions`，并在这里应用 CLI 默认值。
3. 如果参数进入 server 配置，在 [src/server/AGENTS.md](../server/AGENTS.md) 的 `config.ts` 流程中完成校验和消费。
4. 只影响 CLI 行为的参数（例如 `--open`）不需要改 server。
5. 补 `options.test.ts` 或对应行为测试。
6. 更新根 README；用户可见的安装/用法变化同时更新 `README.md` 和 `README_CN.md`。

## 测试

- `options.test.ts`：参数映射和非法值校验。
- `which.test.ts`：按 PATH / PATHEXT 查找、跳过非可执行文件和目录；Windows 分支通过 stub `process.platform` 覆盖。
- `browser.ts` 的平台 / WSL 分支没有单测：分支由平台和环境变量决定；改动时在真实 WSL / Linux 上手动验证。
- `lifecycle.test.ts`：用子进程验证信号：`SIGHUP` 生效、继承的 `SIG_IGN` 仍能收到、重复信号只关闭一次；保留现有的 settle/timeout 常量，不要用更短的等待时间制造不稳定测试。
- `web-source.test.ts`：覆盖 dev URL 分支和 `dist/web` 路径；dist 分支依赖先执行 web 构建。
- 修改 `web-source.ts` 时至少手动验证未构建时的错误信息。

## 构建与发布

- `tsc -b` 输出到 `dist/cli/src`；`bin.srvmd` 指向 `./dist/cli/src/index.js`。
- `dist/cli/src/index.js` 保留 `#!/usr/bin/env node`。
- 根 package 的 `files` 只包含 `dist`、README、README_CN、ARCHITECTURE、LICENSE、CHANGELOG；不发布 `src`。
- 运行时依赖：`commander`、`markdown-it`、`mermaid`、`mime`、`shiki`、`ws`、`yaml` 都在根 `package.json`。
- 发布前执行 `pnpm pack`，确认 tarball 有 `dist/cli/src/index.js` 和 `dist/web`，没有 `src/` 或测试文件。

## 代码风格

- 相对导入使用 `.js` 后缀；TypeScript 会把源码中的 `.js` 映射到 `.ts`，构建后的 `.d.ts` 也保持 `.js`。
- 代码注释用英文。
- CLI 错误信息由 `src/cli/src/index.ts` 统一加 `srvmd: ` 前缀；其他模块的错误不要重复加。
- 不要把业务逻辑、页面拼装或 HTTP 语义放进 `src/cli/`；server 也不拼页面结构。
