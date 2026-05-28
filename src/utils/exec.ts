import { execa } from 'execa';
import { logger } from './logger.js';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  silent?: boolean;
}

export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { cwd, env, timeout = 300000, silent = false } = options;

  if (!silent) {
    logger.debug(`Executing: ${command} ${args.join(' ')}`, { cwd });
  }

  try {
    const result = await execa(command, args, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      reject: false,
      all: true,
    });

    if (!silent) {
      logger.debug(`Command completed with exit code: ${result.exitCode}`);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    logger.error(`Command failed: ${command}`, { error });
    throw error;
  }
}

export async function execStrict(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<string> {
  const result = await exec(command, args, options);

  if (result.exitCode !== 0) {
    throw new Error(
      `Command '${command} ${args.join(' ')}' failed with exit code ${result.exitCode}: ${result.stderr}`
    );
  }

  return result.stdout;
}
