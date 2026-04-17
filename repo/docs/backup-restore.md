# NexusOrder Desk -- Backup and Restore

## Backup

**Implementation**: `apps/service/src/modules/backupRestore/backupService.ts`

- Creates encrypted archive of all MongoDB collections
- Generates SHA-256 checksum for integrity verification
- Stores backup metadata in `backups` collection
- Supports manual trigger (admin) and scheduled via `backupSchedulerJob`
- Destination path configurable via `PUT /api/settings/backup-destination`

## Restore

**Implementation**: `apps/service/src/modules/backupRestore/restoreService.ts`

- Validates SHA-256 checksum before restore
- Decrypts and replays collection data
- Admin-only operation (`restore:restore` permission)

## API Endpoints

- `GET /api/backups` -- list all backups
- `POST /api/backups` -- create a new backup
- `GET /api/backups/:id` -- get backup details
- `POST /api/restore` -- restore from a backup

## Scheduling

The `backupSchedulerJob` can be configured to run automated backups on a cron schedule.
