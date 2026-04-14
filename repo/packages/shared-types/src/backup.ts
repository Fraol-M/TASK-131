export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Backup {
  _id: string;
  filename: string;
  destinationPath: string;
  sizeBytes: number;
  checksum: string; // SHA-256 of archive
  status: BackupStatus;
  triggeredBy: 'scheduled' | 'manual';
  triggeredByUserId?: string;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface RestoreEvent {
  _id: string;
  backupId: string;
  restoredBy: string;
  status: 'pending' | 'validating' | 'restoring' | 'completed' | 'failed';
  checksumVerified: boolean;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface UpdatePackage {
  _id: string;
  filename: string;
  version: string;
  checksum: string;
  importedBy: string;
  importedAt: Date;
  status: 'staged' | 'applied' | 'rolled_back' | 'failed';
  stagedPath?: string;   // absolute path to extracted build directory on disk
  appliedBy?: string;
  appliedAt?: Date;
  rolledBackAt?: Date;
  rollbackReason?: string;
}

export interface RollbackEvent {
  _id: string;
  updatePackageId: string;
  previousVersion: string;
  targetVersion: string;
  trigger: 'health_check_failure' | 'manual';
  triggeredBy?: string;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}
