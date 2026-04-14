/**
 * Integration tests for the rollback orchestrator.
 * Verifies symlink swap logic, DB event recording for success and failure,
 * and promote-update archival behavior.
 *
 * Uses a temporary directory as BUILDS_DIR to isolate filesystem side effects.
 * process.env['BUILDS_DIR'] must be set before the module is loaded.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDb } from '../../../src/persistence/mongoClient.js';

let tmpDir: string;
let rollbackOrchestrator: typeof import('../../../src/updates/rollbackOrchestrator.js')['rollbackOrchestrator'];

beforeAll(async () => {
  // Create a temp builds directory and set env BEFORE importing the module
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-test-'));
  process.env['BUILDS_DIR'] = tmpDir;

  // Dynamic import so the module reads our env var at load time
  const mod = await import('../../../src/updates/rollbackOrchestrator.js');
  rollbackOrchestrator = mod.rollbackOrchestrator;
});

afterAll(() => {
  // Clean up temp directory
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* best effort */ }
  delete process.env['BUILDS_DIR'];
});

beforeEach(() => {
  // Clean up symlinks/dirs between tests
  const currentLink = path.join(tmpDir, 'current');
  const previousLink = path.join(tmpDir, 'previous');
  try { if (fs.existsSync(currentLink)) fs.unlinkSync(currentLink); } catch { /* ignore */ }
  try { if (fs.existsSync(previousLink)) fs.unlinkSync(previousLink); } catch { /* ignore */ }
});

function createBuildDir(name: string): string {
  const dir = path.join(tmpDir, name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createSymlink(target: string, linkPath: string): void {
  // Use 'junction' on Windows for directory symlinks (no admin required)
  fs.symlinkSync(target, linkPath, 'junction');
}

describe('rollbackOrchestrator.rollbackToPrevious()', () => {
  it('swaps current and previous symlinks and records success event', async () => {
    const buildV1 = createBuildDir('build-v1');
    const buildV2 = createBuildDir('build-v2');
    const currentLink = path.join(tmpDir, 'current');
    const previousLink = path.join(tmpDir, 'previous');

    // current → v2, previous → v1
    createSymlink(buildV2, currentLink);
    createSymlink(buildV1, previousLink);

    await rollbackOrchestrator.rollbackToPrevious('health_check_failed');

    // After rollback: current → v1, previous → v2
    const currentTarget = fs.readlinkSync(currentLink);
    const previousTarget = fs.readlinkSync(previousLink);
    expect(path.resolve(currentTarget)).toBe(path.resolve(buildV1));
    expect(path.resolve(previousTarget)).toBe(path.resolve(buildV2));

    // Verify DB event
    const event = await getDb().collection('rollback_events')
      .findOne({ reason: 'health_check_failed', status: 'success' });
    expect(event).not.toBeNull();
    expect(event!.rolledBackTo).toBeDefined();
    expect(event!.timestamp).toBeInstanceOf(Date);
  });

  it('records failure event when no previous build exists', async () => {
    const buildV2 = createBuildDir('build-v2-noprev');
    const currentLink = path.join(tmpDir, 'current');
    createSymlink(buildV2, currentLink);
    // No previous symlink exists

    await rollbackOrchestrator.rollbackToPrevious('no_previous_available');

    // Current should be unchanged
    const currentTarget = fs.readlinkSync(currentLink);
    expect(path.resolve(currentTarget)).toBe(path.resolve(buildV2));

    // Verify failure event in DB
    const event = await getDb().collection('rollback_events')
      .findOne({ reason: 'no_previous_available', status: 'failed' });
    expect(event).not.toBeNull();
    expect(event!.error).toBe('No previous build available');
  });
});

describe('rollbackOrchestrator.promoteUpdate()', () => {
  it('promotes staged build to current and archives old current as previous', async () => {
    const buildV1 = createBuildDir('build-v1-promote');
    const buildV2 = createBuildDir('build-v2-promote');
    const currentLink = path.join(tmpDir, 'current');
    const previousLink = path.join(tmpDir, 'previous');

    // Current → v1, no previous
    createSymlink(buildV1, currentLink);

    await rollbackOrchestrator.promoteUpdate(buildV2);

    // After promote: current → v2, previous → v1
    const currentTarget = fs.readlinkSync(currentLink);
    const previousTarget = fs.readlinkSync(previousLink);
    expect(path.resolve(currentTarget)).toBe(path.resolve(buildV2));
    expect(path.resolve(previousTarget)).toBe(path.resolve(buildV1));
  });

  it('promotes when no current link exists yet (first deploy)', async () => {
    const buildV1 = createBuildDir('build-v1-first');
    const currentLink = path.join(tmpDir, 'current');

    await rollbackOrchestrator.promoteUpdate(buildV1);

    const currentTarget = fs.readlinkSync(currentLink);
    expect(path.resolve(currentTarget)).toBe(path.resolve(buildV1));

    // No previous should exist on first deploy
    const previousLink = path.join(tmpDir, 'previous');
    expect(fs.existsSync(previousLink)).toBe(false);
  });
});
