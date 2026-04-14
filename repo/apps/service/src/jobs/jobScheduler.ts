import cron from 'node-cron';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { config } from '../config/index.js';

const log = createModuleLogger('jobScheduler');

interface RegisteredJob {
  name: string;
  task: cron.ScheduledTask;
}

const registeredJobs: RegisteredJob[] = [];

/**
 * Central job registry — all recurring jobs must be registered here so
 * teardown is explicit and no timers are leaked.
 */
function registerJob(name: string, schedule: string, handler: () => Promise<void>): void {
  const task = cron.schedule(schedule, () => {
    handler().catch((err) => log.error({ err, job: name }, 'Job failed'));
  });
  registeredJobs.push({ name, task });
  log.info({ job: name, schedule }, 'Job registered');
}

export function startAllJobs(): void {
  // Lazy imports to avoid circular deps at module load time
  import('./autoCancelJob.js').then(({ runAutoCancelJob }) => {
    registerJob('auto-cancel-unpaid-orders', '*/5 * * * *', runAutoCancelJob);
  }).catch((err) => log.error({ err }, 'Failed to load autoCancelJob'));

  import('./autoCloseJob.js').then(({ runAutoCloseJob }) => {
    registerJob('auto-close-delivered-orders', '0 */1 * * *', runAutoCloseJob);
  }).catch((err) => log.error({ err }, 'Failed to load autoCloseJob'));

  import('./backupSchedulerJob.js').then(({ runBackupJob }) => {
    registerJob('daily-backup', config.backup.scheduleCron, runBackupJob);
  }).catch((err) => log.error({ err }, 'Failed to load backupSchedulerJob'));

  import('./reminderJob.js').then(({ runReminderJob }) => {
    registerJob('reminders', '0 8 * * *', runReminderJob);
  }).catch((err) => log.error({ err }, 'Failed to load reminderJob'));

  log.info('All background jobs started');
}

export function stopAllJobs(): void {
  for (const { name, task } of registeredJobs) {
    task.stop();
    log.info({ job: name }, 'Job stopped');
  }
  registeredJobs.length = 0;
}
