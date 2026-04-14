import { backupService } from '../modules/backupRestore/backupService.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('backupSchedulerJob');

export async function runBackupJob(): Promise<void> {
  log.info('Scheduled backup starting');
  try {
    await backupService.createBackup({ triggeredBy: 'scheduled' });
    log.info('Scheduled backup completed');
  } catch (err) {
    log.error({ err }, 'Scheduled backup failed');
  }
}
