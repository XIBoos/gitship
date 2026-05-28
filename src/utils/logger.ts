type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(level: LogLevel = 'info', prefix: string = 'deploy') {
    this.level = level;
    this.prefix = prefix;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private formatMessage(level: LogLevel, message: string, data?: object): string {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${message}`;
    if (data) {
      return `${base} ${JSON.stringify(data)}`;
    }
    return base;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(message: string, data?: object): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: object): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: object): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: object): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);
export { Logger };
