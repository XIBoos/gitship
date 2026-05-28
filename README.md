# GitShip

一个通用的 Docker 容器工具，用于从 Git 仓库拉取前端项目代码、构建并部署到宿主机指定目录。

**Ship your frontend from Git to production.**

## 目录

- [项目概述](#项目概述)
- [核心特性](#核心特性)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [运行模式](#运行模式)
- [Docker Compose 部署](#docker-compose-部署)
- [认证方式](#认证方式)
- [缓存机制](#缓存机制)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 项目概述

Web Deploy Helper 解决了前端项目持续部署的痛点：

- **构建环境一致性**：在 Docker 容器中统一构建，避免"在我机器上能跑"的问题
- **部署效率**：通过智能缓存（Git 仓库、node_modules）减少重复下载和安装
- **安全性**：构建失败不影响生产环境，只有全流程成功才会更新文件
- **灵活性**：支持多种触发方式（一次性执行、定时任务、API 触发）

### 适用场景

| 场景 | 说明 |
|------|------|
| CI/CD 集成 | 在流水线中调用，完成构建和部署 |
| 定时同步 | 每日/每周自动拉取最新代码并部署 |
| 远程触发 | 通过 API 触发部署，支持 Webhook 集成 |
| 多项目管理 | 一个镜像管理多个前端项目的部署 |
| Monorepo 项目 | 支持指定前端项目在仓库中的子目录 |

---

## 核心特性

### ✅ 镜像一次构建，到处复用

单个 Docker 镜像支持部署任意前端项目（Vue、React、Angular 等），通过配置文件区分不同项目。

### ✅ 智能缓存加速

| 缓存类型 | 作用 | 默认启用 |
|----------|------|----------|
| Git 仓库缓存 | 增量拉取代码，避免每次全量 clone | ✅ |
| node_modules 缓存 | 对比 package-lock.json，未变化则跳过安装 | ✅ |

### ✅ 安全构建机制

- 构建在容器内临时目录完成
- 只有全流程成功才会同步到输出目录
- 任何失败不影响宿主机现有文件

### ✅ 灵活配置

- YAML 配置文件管理所有设置
- 环境变量覆盖任意配置项
- 敏感信息（Token、密钥）通过环境变量传递

### ✅ 多种运行模式

| 模式 | 命令 | 适用场景 |
|------|------|----------|
| 一次性执行 | `--once` | CI/CD 流水线、手动触发 |
| 定时任务 | `--schedule "0 */6 * * *"` | 周期性自动部署 |
| API 服务 | `--api --port 3000` | 集成 Webhook、远程触发 |

### ✅ 完善的通知机制

构建失败时自动发送 Webhook 通知，支持对接：
- 企业微信/钉钉
- Slack
- 自定义 HTTP 端点

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker 容器                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    deploy-helper                        │ │
│  │                                                         │ │
│  │   ┌─────────────┐    ┌─────────────┐                  │ │
│  │   │ 配置加载    │───▶│ Git 操作    │                  │ │
│  │   │ (YAML+ENV)  │    │ clone/fetch │                  │ │
│  │   └─────────────┘    └──────┬──────┘                  │ │
│  │                              │                          │ │
│  │                              ▼                          │ │
│  │   ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │ │
│  │   │ 缓存管理    │◀───│ 依赖安装    │───▶│ 项目构建  │ │ │
│  │   │ repo/deps   │    │ npm install │    │ npm build │ │ │
│  │   └─────────────┘    └─────────────┘    └─────┬─────┘ │ │
│  │                                                │        │ │
│  │                                                ▼        │ │
│  │                              ┌─────────────────────┐   │ │
│  │                              │ 输出同步 (rsync)     │   │ │
│  │                              │ 应用排除规则        │   │ │
│  │                              └──────────┬──────────┘   │ │
│  │                                         │              │ │
│  │   ┌─────────────┐                       │              │ │
│  │   │ 错误处理    │◀──────────────────────┤              │ │
│  │   │ 通知发送    │                       │              │ │
│  │   └─────────────┘                       │              │ │
│  └─────────────────────────────────────────│──────────────┘ │
│                                            │                │
└────────────────────────────────────────────│────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         │                                   │                                   │
         ▼                                   ▼                                   ▼
   /cache/repos/                        /cache/deps/                        /output/
   (Git 仓库缓存)                        (node_modules)                      (构建产物)
         │                                   │                                   │
    ┌────┴────┐                         ┌────┴────┐                        ┌────┴────┐
    │ 宿主机   │                         │ 宿主机   │                        │ 宿主机   │
    │ 挂载卷   │                         │ 挂载卷   │                        │ 挂载卷   │
    └─────────┘                         └─────────┘                        └─────────┘
```

### 数据流

```
1. 配置加载
   YAML 配置文件 → 环境变量覆盖 → 配置验证

2. 代码获取
   检查缓存 → 存在: git fetch (增量) / 不存在: git clone (全量) → checkout 到指定版本

3. 依赖安装
   检查缓存 → 对比 package-lock.json → 未变化: 复用 / 有变化: npm install → 缓存

4. 项目构建
   执行构建命令 → 失败: 退出并发送通知

5. 输出同步
   过滤排除文件 → rsync 到输出目录 → 完成通知
```

---

## 快速开始

### 1. 准备配置文件

创建 `deploy-config.yaml`：

```yaml
repo:
  url: "https://gitea.example.com/my-group/my-project.git"
  branch: "main"

build:
  command: "npm run build"

output:
  dir: "/output"
  exclude:
    - "*.map"
    - "*.log"

cache:
  dir: "/cache"
  git: true
  deps: true
```

### 2. 运行容器

```bash
docker run --rm \
  -v $(pwd)/deploy-config.yaml:/config/deploy.yaml \
  -v /data/www/my-project:/output \
  -v /data/cache/my-project:/cache \
  -e GIT_USERNAME=your-username \
  -e GIT_TOKEN=your-token \
  gitship:latest
```

### 3. 查看结果

构建成功后，产物位于宿主机 `/data/www/my-project` 目录。

---

## 配置说明

### 配置文件结构

```yaml
# deploy-config.yaml

# ==================== 仓库配置 ====================
repo:
  url: ""                    # [必需] 仓库地址，支持 HTTPS 和 SSH
  branch: "main"             # 分支名称
  version: ""                # 版本标识（Tag 或 Commit Hash），不指定则使用分支最新
  subdirectory: ""           # 前端项目在仓库中的相对路径（如 monorepo 中的 frontend 或 packages/web）

# ==================== 构建配置 ====================
build:
  command: "npm run build"   # 构建命令
  install_command: "npm install"  # 依赖安装命令（支持 npm ci, yarn, pnpm）
  node_version: ""           # 指定 Node 版本（需容器支持）

# ==================== 输出配置 ====================
output:
  dir: "/output"             # 输出目录（容器内路径，需挂载到宿主机）
  exclude:                   # 排除文件列表
    - "*.map"                # 排除所有 .map 文件
    - "*.log"                # 排除所有 .log 文件
    - ".git"                 # 排除 .git 目录
    - "node_modules"         # 排除 node_modules
    - "test/"                # 排除 test 目录
    - "docs/"                # 排除 docs 目录

# ==================== 缓存配置 ====================
cache:
  dir: "/cache"              # 缓存根目录
  git: true                  # 是否缓存 Git 仓库
  deps: true                 # 是否缓存 node_modules

# ==================== 错误处理 ====================
error:
  on_error: "stop"           # 失败时行为: stop(仅停止) | notify(发送通知)
  webhook: ""                # 通知 Webhook URL

# ==================== 定时任务（可选） ====================
schedule:
  enabled: false             # 是否启用定时模式
  cron: ""                   # Cron 表达式，如 "0 */6 * * *" 每6小时

# ==================== API 服务（可选） ====================
api:
  enabled: false             # 是否启用 API 模式
  port: 3000                 # API 服务端口
```

### 环境变量覆盖

所有配置项均可通过环境变量覆盖，优先级：**环境变量 > 配置文件 > 默认值**

| 配置路径 | 环境变量 | 示例 |
|----------|----------|------|
| `repo.url` | `REPO_URL` | `https://gitea.example.com/group/project.git` |
| `repo.branch` | `REPO_BRANCH` | `develop` |
| `repo.version` | `REPO_VERSION` | `v1.2.0` 或 `abc123` |
| `repo.subdirectory` | `REPO_SUBDIRECTORY` | `frontend` 或 `packages/web` |
| `build.command` | `BUILD_COMMAND` | `npm run build:prod` |
| `build.install_command` | `BUILD_INSTALL_COMMAND` | `npm ci` |
| `output.dir` | `OUTPUT_DIR` | `/data/dist` |
| `output.exclude` | `OUTPUT_EXCLUDE` | `*.map:*.log:test/` |
| `cache.git` | `CACHE_GIT` | `true` / `false` |
| `cache.deps` | `CACHE_DEPS` | `true` / `false` |
| `error.on_error` | `ERROR_ON_ERROR` | `stop` / `notify` |
| `error.webhook` | `ERROR_WEBHOOK` | `https://example.com/webhook` |
| `schedule.cron` | `SCHEDULE_CRON` | `0 */6 * * *` |
| `api.port` | `API_PORT` | `8080` |

### 认证环境变量

| 环境变量 | 说明 | 使用场景 |
|----------|------|----------|
| `GIT_USERNAME` | Git 用户名 | HTTPS 认证 |
| `GIT_TOKEN` | Git Token/密码 | HTTPS 认证 |
| `SSH_PRIVATE_KEY` | SSH 私钥内容 | SSH 认证 |
| `SSH_KNOWN_HOSTS` | 已知主机公钥 | SSH 认证（可选） |

---

## 运行模式

### 模式一：一次性执行（默认）

执行完成后容器退出，适合 CI/CD 流水线。

```bash
docker run --rm \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  -e GIT_TOKEN=xxx \
  gitship

# 或显式指定
docker run --rm \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  -e GIT_TOKEN=xxx \
  gitship --once
```

### 模式二：定时任务

容器持续运行，按 Cron 表达式定时执行部署。

```bash
docker run -d \
  --name deploy-scheduler \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  -e GIT_TOKEN=xxx \
  gitship --schedule "0 */6 * * *"
```

**Cron 表达式示例：**

| 表达式 | 含义 |
|--------|------|
| `0 */6 * * *` | 每 6 小时 |
| `0 9 * * *` | 每天上午 9:00 |
| `0 9 * * 1-5` | 周一到周五上午 9:00 |
| `*/30 * * * *` | 每 30 分钟 |

### 模式三：API 服务

启动 HTTP 服务，通过 API 触发部署。

```bash
docker run -d \
  --name deploy-api \
  -p 3000:3000 \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  -e GIT_TOKEN=xxx \
  gitship --api --port 3000
```

**API 端点：**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/deploy` | POST | 触发部署 |
| `/status` | GET | 获取最近部署状态 |

**调用示例：**

```bash
# 触发部署
curl -X POST http://localhost:3000/deploy

# 查看状态
curl http://localhost:3000/status

# 健康检查
curl http://localhost:3000/health
```

**响应示例：**

```json
// POST /deploy 成功
{
  "success": true,
  "commitHash": "abc123def456...",
  "timestamp": "2026-05-28T10:00:00Z"
}

// POST /deploy 失败
{
  "success": false,
  "commitHash": "abc123def456...",
  "error": "npm run build exited with code 1",
  "stage": "build",
  "timestamp": "2026-05-28T10:00:00Z"
}

// GET /status
{
  "deploying": false,
  "lastResult": {
    "success": true,
    "commitHash": "abc123def456...",
    "timestamp": "2026-05-28T10:00:00Z"
  }
}
```

---

## Docker Compose 部署

使用 Docker Compose 可以简化多项目的部署管理，统一配置和启动。

### 步骤 1：构建镜像

```bash
# 进入项目目录
cd gitship

# 构建 Docker 镜像
docker build -t gitship:latest .
```

**或者使用 docker-compose 自动构建：**

在 `docker-compose.yml` 中使用 `build` 配置：

```yaml
services:
  project-a:
    build:
      context: .
      dockerfile: Dockerfile
    # ... 其他配置
```

然后运行：
```bash
docker-compose up -d --build
```

### 步骤 3：准备目录结构

```
/opt/deploy/
├── docker-compose.yml      # 从 docker-compose.example.yml 复制
├── .env                    # 敏感信息（GIT_TOKEN）
└── config/
    ├── project-a.yaml
    ├── project-b.yaml
    └── project-c.yaml
```

### 步骤 4：docker-compose.yml 示例

完整示例请参考项目中的 `docker-compose.example.yml` 文件。以下是一个简化配置：

```yaml
version: '3.8'

services:
  # 项目 A - 定时部署（每天早上 6 点）
  project-a:
    image: gitship:latest
    container_name: deploy-project-a
    restart: unless-stopped
    volumes:
      - ./config/project-a.yaml:/config/deploy.yaml:ro
      - /var/www/project-a:/output
      - deploy-cache-a:/cache
    environment:
      - GIT_TOKEN=${GIT_TOKEN}
    command: ["--schedule", "0 6 * * *"]

  # 项目 B - API 模式（手动触发）
  project-b:
    image: gitship:latest
    container_name: deploy-project-b
    restart: unless-stopped
    ports:
      - "3001:3000"
    volumes:
      - ./config/project-b.yaml:/config/deploy.yaml:ro
      - /var/www/project-b:/output
      - deploy-cache-b:/cache
    environment:
      - GIT_TOKEN=${GIT_TOKEN}
    command: ["--api", "--port", "3000"]

# 命名卷管理缓存（隔离各项目缓存）
volumes:
  deploy-cache-a:
  deploy-cache-b:
```

### 步骤 5：配置环境变量

```bash
# 敏感信息单独存放，不要提交到版本控制
GIT_TOKEN=your-gitea-token-here
```

### 配置文件示例

**config/project-a.yaml:**

```yaml
repo:
  url: "https://gitea.example.com/group/project-a.git"
  branch: "main"

build:
  command: "npm run build"
  install_command: "npm ci"

output:
  dir: "/output"
  exclude:
    - "*.map"
    - "*.log"

cache:
  git: true
  deps: true

error:
  on_error: "notify"
  webhook: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"
```

### 常用命令

```bash
# 启动所有服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看某个服务的日志
docker-compose logs -f project-a

# 手动触发一次性部署（覆盖定时配置）
docker-compose run --rm project-a --once

# 重启某个服务
docker-compose restart project-a

# 更新配置后重启
docker-compose down && docker-compose up -d

# 停止所有服务
docker-compose down

# 停止服务并清除缓存数据
docker-compose down -v
```

### API 模式触发部署

对于 API 模式的服务（如 project-c），可以通过 HTTP 请求触发：

```bash
# 触发部署
curl -X POST http://localhost:3001/deploy

# 查看部署状态
curl http://localhost:3001/status

# 健康检查
curl http://localhost:3001/health
```

---

## 认证方式

### HTTPS 认证（推荐）

使用用户名和 Token 认证：

```bash
docker run --rm \
  -e GIT_USERNAME=your-username \
  -e GIT_TOKEN=your-personal-access-token \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  gitship
```

**获取 Gitea Token：**
1. 登录 Gitea → 设置 → 应用 → 管理访问令牌
2. 生成新令牌，勾选 `repo` 权限
3. 复制令牌用于 `GIT_TOKEN`

### SSH 认证

使用 SSH 密钥认证：

```bash
docker run --rm \
  -e SSH_PRIVATE_KEY="$(cat ~/.ssh/id_rsa)" \
  -e SSH_KNOWN_HOSTS="$(ssh-keyscan gitea.example.com)" \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  gitship
```

**注意：**
- 私钥需要无密码保护，或使用 `ssh-agent`
- `SSH_KNOWN_HOSTS` 可选，不提供时跳过主机验证

### 公开仓库

无需认证：

```bash
docker run --rm \
  -v deploy-config.yaml:/config/deploy.yaml \
  -v /data/output:/output \
  -v /data/cache:/cache \
  gitship
```

---

## 缓存机制

### Git 仓库缓存

```
首次克隆:
  git clone → 完整下载 → 缓存到 /cache/repos/<hash>

后续更新:
  git fetch → 只下载变更部分 → 更新缓存
```

**优势：**
- 避免每次全量克隆，节省带宽
- 切换分支/Tag 只需 checkout，无需重新下载

### node_modules 缓存

```
每次安装前:
  1. 对比 repo/package-lock.json 和 cache/package-lock.json
  2. 相同 → 复用缓存
  3. 不同 → npm install → 更新缓存
```

**优势：**
- 大幅减少 `npm install` 时间
- 对比 MD5 确保依赖一致性

### 缓存目录结构

```
/cache/
├── repos/
│   ├── a1b2c3d4e5f6/     # 项目 A 的 Git 仓库
│   └── 7890abcdef12/     # 项目 B 的 Git 仓库
└── deps/
    ├── a1b2c3d4e5f6/
    │   ├── node_modules/  # 项目 A 的依赖
    │   └── package-lock.json
    └── 7890abcdef12/
        ├── node_modules/  # 项目 B 的依赖
        └── package-lock.json
```

### 禁用缓存

```bash
# 禁用 Git 缓存（每次全量克隆）
-e CACHE_GIT=false

# 禁用依赖缓存（每次重新安装）
-e CACHE_DEPS=false
```

---

## 错误处理

### 错误策略

| 策略 | 配置 | 行为 |
|------|------|------|
| `stop` | `on_error: "stop"` | 停止执行，容器退出码非零 |
| `notify` | `on_error: "notify"` | 发送 Webhook 通知后停止 |

### 安全机制

**无论何种错误策略，失败时都不会影响输出目录：**

```
正常流程:
  构建产物 → 临时目录 → 全部成功 → rsync 到 OUTPUT_DIR

失败流程:
  构建产物 → 临时目录 → 任何失败 → 删除临时目录 → OUTPUT_DIR 不变
```

### 通知格式

```json
{
  "event": "deploy_failed",
  "repo": "https://gitea.example.com/group/project.git",
  "branch": "main",
  "version": "v1.2.0",
  "stage": "build",
  "error": "npm run build exited with code 1",
  "timestamp": "2026-05-28T10:00:00Z"
}
```

**对接企业微信：**

```yaml
error:
  on_error: "notify"
  webhook: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"
```

**对接钉钉：**

```yaml
error:
  on_error: "notify"
  webhook: "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN"
```

---

## 最佳实践

### 1. 目录挂载建议

```bash
# 生产环境推荐挂载方式
docker run \
  -v /opt/deploy/config:/config:ro \        # 配置只读
  -v /var/www/project:/output \              # 输出目录
  -v /var/cache/deploy:/cache \              # 缓存目录（持久化）
  -e GIT_TOKEN=xxx \
  gitship
```

### 2. 多项目管理

推荐使用 Docker Compose 管理多个项目，详见 [Docker Compose 部署](#docker-compose-部署) 章节。

手动管理多个项目：

```bash
# 项目 A
docker run --name deploy-project-a \
  -v /opt/config/project-a.yaml:/config/deploy.yaml \
  -v /var/www/project-a:/output \
  -v /var/cache/project-a:/cache \
  -e GIT_TOKEN=xxx \
  -d gitship --schedule "0 6 * * *"

# 项目 B
docker run --name deploy-project-b \
  -v /opt/config/project-b.yaml:/config/deploy.yaml \
  -v /var/www/project-b:/output \
  -v /var/cache/project-b:/cache \
  -e GIT_TOKEN=xxx \
  -d gitship --schedule "0 7 * * *"
```

### 3. 版本锁定

```yaml
# 生产环境锁定版本
repo:
  url: "https://gitea.example.com/group/project.git"
  branch: "main"
  version: "v2.1.0"  # 锁定 Tag

# 测试环境跟踪分支
repo:
  url: "https://gitea.example.com/group/project.git"
  branch: "develop"
  # 不指定 version，使用最新
```

### 4. 构建命令优化

```yaml
# 生产构建
build:
  command: "npm run build:prod"
  install_command: "npm ci --prefer-offline"

# 开发构建
build:
  command: "npm run build:dev"
  install_command: "npm install"
```

---

## 常见问题

### Q1: 构建失败但输出目录被清空？

A: 不会。只有全流程成功才会同步到输出目录。失败时输出目录保持不变。

### Q2: 如何切换 Node 版本？

A: 需要构建支持多版本的 Docker 镜像，或使用 nvm：

```yaml
build:
  node_version: "18"
  command: "source ~/.nvm/nvm.sh && nvm use 18 && npm run build"
```

### Q3: 缓存占用太多磁盘空间？

A: 定期清理缓存目录：

```bash
# 清理特定项目缓存
rm -rf /var/cache/deploy/repos/<project-hash>
rm -rf /var/cache/deploy/deps/<project-hash>

# 清理所有缓存
rm -rf /var/cache/deploy/*
```

### Q4: 如何查看构建日志？

A: 查看容器日志：

```bash
docker logs deploy-project-a

# 实时查看
docker logs -f deploy-project-a
```

### Q5: SSH 认证失败？

A: 检查以下几点：
1. 私钥格式正确（以 `-----BEGIN` 开头）
2. 私钥无密码保护
3. 公钥已添加到 Gitea 账户
4. 仓库 URL 使用 SSH 格式（`git@gitea.example.com:group/project.git`）

### Q6: 如何部署 Monorepo 中的前端项目？

A: 使用 `subdirectory` 配置指定前端项目路径：

```yaml
repo:
  url: "https://gitea.example.com/group/monorepo.git"
  branch: "main"
  subdirectory: "frontend"  # 或 "packages/web" 等
```

构建时会在仓库根目录下的 `frontend` 子目录中执行 `install` 和 `build`。

### Q7: 如何对接 CI/CD 系统？

A: 使用一次性模式，根据退出码判断成功/失败：

```bash
# GitLab CI 示例
deploy:
  stage: deploy
  script:
    - docker run --rm
        -v $CI_PROJECT_DIR/deploy-config.yaml:/config/deploy.yaml
        -v /var/www/$CI_PROJECT_NAME:/output
        -v /var/cache/$CI_PROJECT_NAME:/cache
        -e GIT_TOKEN=$GIT_TOKEN
        gitship
```

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js 18 LTS |
| 语言 | TypeScript |
| 打包工具 | tsup |
| 配置解析 | js-yaml |
| 命令执行 | execa |
| CLI 框架 | commander |
| HTTP 框架 | hono |
| 定时任务 | node-cron |
| 文件同步 | rsync |

---

## 许可证

MIT License
