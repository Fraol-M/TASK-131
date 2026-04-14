import { getDb } from '../../persistence/mongoClient.js';
import { config } from '../../config/index.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('settingsService');

interface SystemSetting {
  _id: string;
  value: string;
  updatedBy: string;
  updatedAt: Date;
}

const BACKUP_DESTINATION_KEY = 'backup_destination';

export const settingsService = {
  async getBackupDestination(): Promise<string> {
    try {
      const setting = await getDb()
        .collection<SystemSetting>('system_settings')
        .findOne({ _id: BACKUP_DESTINATION_KEY } as object);
      return setting?.value ?? config.backup.destinationPath;
    } catch (err) {
      log.warn({ err }, 'Could not read backup destination from DB — using config default');
      return config.backup.destinationPath;
    }
  },

  async setBackupDestination(destinationPath: string, updatedBy: string): Promise<void> {
    await getDb()
      .collection<SystemSetting>('system_settings')
      .updateOne(
        { _id: BACKUP_DESTINATION_KEY } as object,
        { $set: { value: destinationPath, updatedBy, updatedAt: new Date() } },
        { upsert: true },
      );
    log.info({ destinationPath, updatedBy }, 'Backup destination updated');
  },

  async getAllSettings(): Promise<SystemSetting[]> {
    return getDb().collection<SystemSetting>('system_settings').find({}).toArray();
  },
};
