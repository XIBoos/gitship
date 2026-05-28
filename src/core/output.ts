import { execStrict } from '../utils/exec.js';
import { logger } from '../utils/logger.js';

export class OutputManager {
  async sync(
    sourceDir: string,
    outputDir: string,
    excludes: string[]
  ): Promise<void> {
    logger.info(`Syncing output from ${sourceDir} to ${outputDir}`);

    const excludeArgs = excludes.flatMap((pattern) => ['--exclude', pattern]);

    const args = [
      '-a',
      '--delete',
      '--prune-empty-dirs',
      ...excludeArgs,
      `${sourceDir}/`,
      outputDir,
    ];

    await execStrict('rsync', args);

    logger.info('Output sync completed');
  }
}
