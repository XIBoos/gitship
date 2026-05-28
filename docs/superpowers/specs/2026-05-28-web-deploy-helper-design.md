# Web Deploy Helper 设计规范

## 概述

一个通用的 Docker 容器工具，用于从 Gitea 仓库拉取前端项目代码、构建并部署到宿主机指定目录。

**核心目标**：
- 镜像构建一次，到处复用
- 利用缓存提升效率（git 仓库、node_modules）
- 任何失败不影响宿主机现有文件

---

## 技术栈

- **运行时**：Node.js 18 LTS
- **语言**：TypeScript
- **构建工具**：tsup（打包为单文件）
- **配置解析**：js-yaml
- **命令执行**：execa
- **参数解析**：commander
- **HTTP 服务**：hono（轻量框架）
- **定时任务**：node-cron
- **文件同步**：rsync（系统命令）

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Docker 容器                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  deploy.js (打包后的单文件入口)                   │   │
│  │                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ Config   │ │ Git      │ │ Build    │        │   │
│  │  │ Manager  │ │ Manager  │ │ Manager  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  │                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ Cache    │ │ Output   │ │ Notify   │        │   │
│  │  │ Manager  │ │ Manager  │ │ Manager  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  │                                                  │   │
│  │  ┌──────────┐ ┌──────────┐                     │   │
│  │  │ API      │ │ Schedule │                     │   │
│  │  │ Server   │ │ Runner   │                     │   │
│  │  └──────────┘ └──────────┘                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  镜像包含: Node.js 18, Git, rsync, OpenSSH             │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   /cache/repos/         /cache/deps/        /output/
   (git 仓库缓存)        (node_modules)      (构建产物)
         │                    │                    │
    ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
    │ 宿主机   │          │ 宿主机   │          │ 宿主机   │
    │ 挂载卷   │          │ 挂载卷   │          │ 挂载卷   │
    └─────────┘          └─────────┘          └─────────┘
```

---

## 配置系统

### 配置文件结构 (deploy-config.yaml)

```yaml
repo:
  url: ""                    # 仓库地址（HTTPS/SSH）
  branch: "main"             # 分支名
  version: ""                # Tag 或 Commit Hash（可选，不指定则用分支最新）

build:
  command: "npm run build"   # 构建命令
  install_command: "npm install"  # 依赖安装命令
  node_version: ""           # 可选，指定 Node 版本

output:
  dir: "/output"             # 输出目录
  exclude:                   # 排除文件列表
    - "*.map"
    - "*.log"
    - ".git"
    - "node_modules"

cache:
  dir: "/cache"              # 缓存根目录
  git: true                  # 是否缓存 git 仓库
  deps: true                 # 是否缓存 node_modules

error:
  on_error: "stop"           # stop | notify
  webhook: ""                # 通知 Webhook URL（建议用环境变量）

schedule:
  enabled: false             # 是否启用定时模式
  cron: ""                   # 定时任务 cron 表达式

api:
  enabled: false             # 是否启用 API 模式
  port: 3000                 # API 服务端口
```

### 配置优先级

```
环境变量 > 配置文件 > 默认值
```

### 环境变量映射

| 配置路径 | 环境变量 | 说明 |
|---------|---------|------|
| `repo.url` | `REPO_URL` | 仓库地址 |
| `repo.branch` | `REPO_BRANCH` | 分支名 |
| `repo.version` | `REPO_VERSION` | 版本标识 |
| `build.command` | `BUILD_COMMAND` | 构建命令 |
| `build.install_command` | `BUILD_INSTALL_COMMAND` | 安装命令 |
| `build.node_version` | `BUILD_NODE_VERSION` | Node 版本 |
| `output.dir` | `OUTPUT_DIR` | 输出目录 |
| `output.exclude` | `OUTPUT_EXCLUDE` | 排除列表（冒号分隔） |
| `cache.dir` | `CACHE_DIR` | 缓存目录 |
| `cache.git` | `CACHE_GIT` | 是否缓存 git |
| `cache.deps` | `CACHE_DEPS` | 是否缓存依赖 |
| `error.on_error` | `ERROR_ON_ERROR` | 错误处理策略 |
| `error.webhook` | `ERROR_WEBHOOK` | 通知 Webhook |
| `schedule.enabled` | `SCHEDULE_ENABLED` | 是否启用定时 |
| `schedule.cron` | `SCHEDULE_CRON` | Cron 表达式 |
| `api.enabled` | `API_ENABLED` | 是否启用 API |
| `api.port` | `API_PORT` | API 端口 |

### 认证相关环境变量

| 环境变量 | 说明 |
|---------|------|
| `GIT_USERNAME` | Git 用户名（HTTPS 认证） |
| `GIT_TOKEN` | Git Token/密码（HTTPS 认证） |
| `SSH_PRIVATE_KEY` | SSH 私钥内容 |
| `SSH_KNOWN_HOSTS` | 已知主机（可选） |

---

## 运行模式

### 模式 1：一次性执行（默认）

```bash
docker run \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  -e GIT_TOKEN=xxx \
  deploy-helper --once
```

执行完成后容器退出。

### 模式 2：定时任务

```bash
docker run \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  -e GIT_TOKEN=xxx \
  deploy-helper --schedule "0 */6 * * *"
```

容器持续运行，按 cron 表达式定时执行部署。

### 模式 3：API 触发

```bash
docker run \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  -e GIT_TOKEN=xxx \
  -p 3000:3000 \
  deploy-helper --api --port 3000
```

容器启动 HTTP 服务：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/deploy` | POST | 触发部署 |
| `/status` | GET | 获取最近部署状态 |

---

## 执行流程

```
1. 加载配置
   ├── 读取 YAML 配置文件（/config/deploy.yaml）
   ├── 环境变量覆盖
   └── 应用默认值

2. 认证设置
   ├── HTTPS：配置 git credential helper
   └── SSH：写入私钥到 ~/.ssh/id_rsa

3. Git 操作
   ├── 检查 /cache/repos/<repo-hash> 是否存在
   │   ├── 存在 → git fetch（增量拉取）
   │   └── 不存在 → git clone
   ├── checkout 到指定分支/Tag/Commit
   └── 记录当前 commit hash

4. 依赖安装
   ├── 检查 /cache/deps/<repo-hash>/node_modules
   ├── 对比 package-lock.json md5 是否变化
   │   ├── 无变化 → 跳过安装
   │   └── 有变化 → 执行 INSTALL_COMMAND
   └── 缓存 node_modules 到宿主机

5. 构建
   └── 执行 BUILD_COMMAND

6. 同步输出
   ├── 构建产物复制到临时目录（容器内）
   ├── 应用排除规则过滤文件
   └── 全部成功 → rsync 到 OUTPUT_DIR

7. 完成
   ├── 成功：退出码 0
   └── 失败：退出码非零，发送通知（如果配置）
```

**关键原则**：只有全流程成功才会更新 OUTPUT_DIR，任何失败不影响宿主机文件。

---

## 错误处理

### 错误策略

| ON_ERROR 值 | 行为 |
|-------------|------|
| `stop` | 停止执行，输出错误日志，容器退出码非零 |
| `notify` | 发送 Webhook 通知后停止 |

### 通知格式

POST 请求到 `ERROR_WEBHOOK`：

```json
{
  "event": "deploy_failed",
  "repo": "https://gitea.xxx.com/group/project.git",
  "branch": "main",
  "version": "v1.2.0",
  "stage": "build",
  "error": "npm run build exited with code 1",
  "timestamp": "2026-05-28T10:00:00Z"
}
```

---

## 项目文件结构

```
web-deploy-helper/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # 入口，CLI 参数解析
│   ├── types.ts              # TypeScript 类型定义
│   ├── config/
│   │   ├── index.ts          # 配置加载入口
│   │   ├── loader.ts         # YAML 加载
│   │   └── env.ts            # 环境变量覆盖
│   ├── core/
│   │   ├── git.ts            # Git 操作
│   │   ├── build.ts          # 构建执行
│   │   ├── cache.ts          # 缓存管理
│   │   └── output.ts         # 输出同步
│   ├── modes/
│   │   ├── once.ts           # 一次性执行模式
│   │   ├── schedule.ts       # 定时任务模式
│   │   └── api.ts            # API 服务模式
│   └── utils/
│       ├── notify.ts         # 通知发送
│       ├── logger.ts         # 日志工具
│       └── exec.ts           # 命令执行封装
├── config/
│   └── default.yaml          # 默认配置
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-28-web-deploy-helper-design.md
```

---

## Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# 生产镜像
FROM node:18-alpine

# 安装运行时依赖
RUN apk add --no-cache \
    git \
    rsync \
    curl \
    openssh-client

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist/deploy.js /app/deploy.js
COPY --from=builder /app/config/default.yaml /app/config/default.yaml

# 创建目录
RUN mkdir -p /cache/repos /cache/deps /output /config

ENTRYPOINT ["node", "/app/deploy.js"]
CMD ["--once"]
```

**镜像大小预估**：~120MB（多阶段构建）

---

## 模块设计

### ConfigManager

```typescript
class ConfigManager {
  load(configPath?: string): DeployConfig
  mergeWithEnv(config: DeployConfig): DeployConfig
  applyDefaults(config: DeployConfig): DeployConfig
}
```

### GitManager

```typescript
class GitManager {
  setupAuth(config: AuthConfig): void
  cloneOrFetch(repoUrl: string, cacheDir: string): string
  checkout(repoDir: string, ref: string): string  // 返回 commit hash
}
```

### BuildManager

```typescript
class BuildManager {
  install(repoDir: string, cacheDir: string): void
  build(repoDir: string, command: string): void
}
```

### CacheManager

```typescript
class CacheManager {
  getRepoCacheDir(repoUrl: string): string
  getDepsCacheDir(repoUrl: string): string
  needsReinstall(repoDir: string, cacheDir: string): boolean
}
```

### OutputManager

```typescript
class OutputManager {
  sync(sourceDir: string, outputDir: string, excludes: string[]): void
}
```

### NotifyManager

```typescript
class NotifyManager {
  send(webhook: string, payload: NotifyPayload): Promise<void>
}
```

---

## CLI 接口

```bash
deploy-helper [options]

Options:
  --once              一次性执行模式（默认）
  --schedule <cron>   定时任务模式
  --api               API 服务模式
  --port <port>       API 端口（默认 3000）
  --config <path>     配置文件路径（默认 /config/deploy.yaml）
  --help              显示帮助
  --version           显示版本
```

---

## 待实现功能清单

1. 项目初始化（package.json, tsconfig.json）
2. TypeScript 类型定义
3. 配置加载模块
4. Git 操作模块
5. 缓存管理模块
6. 构建执行模块
7. 输出同步模块
8. 通知模块
9. 一次性执行模式
10. 定时任务模式
11. API 服务模式
12. Dockerfile
13. 使用文档
