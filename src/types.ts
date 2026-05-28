export interface RepoConfig {
  url: string;
  branch: string;
  version?: string;
  subdirectory?: string;
}

export interface BuildConfig {
  command: string;
  install_command: string;
  node_version?: string;
}

export interface OutputConfig {
  dir: string;
  exclude: string[];
}

export interface CacheConfig {
  dir: string;
  git: boolean;
  deps: boolean;
}

export interface ErrorConfig {
  on_error: 'stop' | 'notify';
  webhook?: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  cron: string;
}

export interface ApiConfig {
  enabled: boolean;
  port: number;
}

export interface DeployConfig {
  repo: RepoConfig;
  build: BuildConfig;
  output: OutputConfig;
  cache: CacheConfig;
  error: ErrorConfig;
  schedule: ScheduleConfig;
  api: ApiConfig;
}

export interface AuthConfig {
  username?: string;
  token?: string;
  ssh_private_key?: string;
  ssh_known_hosts?: string;
}

export interface DeployResult {
  success: boolean;
  commitHash?: string;
  error?: string;
  stage?: 'git' | 'install' | 'build' | 'sync';
  timestamp: string;
}

export interface NotifyPayload {
  event: 'deploy_success' | 'deploy_failed';
  repo: string;
  branch: string;
  version?: string;
  stage?: string;
  error?: string;
  timestamp: string;
}

export const DEFAULT_CONFIG: DeployConfig = {
  repo: {
    url: '',
    branch: 'main',
    version: undefined,
    subdirectory: undefined,
  },
  build: {
    command: 'npm run build',
    install_command: 'npm install',
    node_version: undefined,
  },
  output: {
    dir: '/output',
    exclude: ['*.map', '*.log', '.git', 'node_modules'],
  },
  cache: {
    dir: '/cache',
    git: true,
    deps: true,
  },
  error: {
    on_error: 'stop',
    webhook: undefined,
  },
  schedule: {
    enabled: false,
    cron: '',
  },
  api: {
    enabled: false,
    port: 3000,
  },
};
