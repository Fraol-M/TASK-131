/**
 * mongoManager — spawns and supervises the bundled MongoDB process.
 *
 * Packaged (MSI) mode:
 *   mongod.exe lives at process.resourcesPath/mongod.exe (declared in electron-builder.yml
 *   extraResources).  mongoManager.start() spawns it with --dbpath pointing to a
 *   per-user data directory and waits until the port accepts TCP connections.
 *
 * Dev mode (app.isPackaged === false):
 *   MongoDB is managed externally (Docker compose).
 *   mongoManager.start() is a no-op.
 */

import { app } from 'electron';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('mongoManager');

const MONGO_PORT = 27017;
const READY_TIMEOUT_MS = 45_000;
const READY_POLL_INTERVAL_MS = 500;

let mongoProcess: ChildProcess | null = null;

function getMongodPath(): string | null {
  if (!app.isPackaged) return null; // dev: Docker-managed
  return path.join(process.resourcesPath, 'mongod.exe');
}

function getDataDir(): string {
  return path.join(app.getPath('userData'), 'mongodb', 'data');
}

export const mongoManager = {
  /**
   * Spawns the bundled MongoDB process (MSI mode only).
   * Waits until the port accepts TCP connections or READY_TIMEOUT_MS elapses.
   * Throws if MongoDB does not become ready within the timeout.
   */
  async start(): Promise<void> {
    const mongodPath = getMongodPath();
    if (!mongodPath) {
      log.info('Dev mode: MongoDB managed externally — skipping spawn');
      return;
    }

    if (!fs.existsSync(mongodPath)) {
      throw new Error(
        `Bundled mongod.exe not found at: ${mongodPath}. ` +
        `Drop a Windows x64 MongoDB Community binary into vendor/mongodb/ and rebuild the installer.`,
      );
    }

    const dataDir = getDataDir();
    fs.mkdirSync(dataDir, { recursive: true });

    log.info({ mongodPath, dataDir }, 'Spawning bundled MongoDB process');

    mongoProcess = spawn(mongodPath, [
      '--dbpath', dataDir,
      '--port', String(MONGO_PORT),
      '--bind_ip', '127.0.0.1',
      '--directoryperdb',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    mongoProcess.stdout?.on('data', (chunk: Buffer) => {
      log.info({ src: 'mongo' }, chunk.toString().trimEnd());
    });
    mongoProcess.stderr?.on('data', (chunk: Buffer) => {
      log.warn({ src: 'mongo:err' }, chunk.toString().trimEnd());
    });
    mongoProcess.on('exit', (code, signal) => {
      log.warn({ code, signal }, 'MongoDB process exited unexpectedly');
      mongoProcess = null;
    });
    mongoProcess.on('error', (err) => {
      log.error({ err }, 'Failed to spawn MongoDB process');
    });

    await this.waitForReady();
  },

  /**
   * Polls the MongoDB TCP port until accepting connections or timeout.
   */
  async waitForReady(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const ready = await new Promise<boolean>((resolve) => {
        const sock = net.createConnection({ host: '127.0.0.1', port: MONGO_PORT });
        sock.once('connect', () => { sock.destroy(); resolve(true); });
        sock.once('error', () => resolve(false));
      });
      if (ready) {
        log.info('MongoDB is accepting connections — ready');
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
    }
    throw new Error(`MongoDB did not become ready within ${READY_TIMEOUT_MS}ms`);
  },

  /**
   * Gracefully terminates the MongoDB process.
   * Called from app before-quit handler.
   */
  stop(): void {
    if (mongoProcess) {
      log.info('Sending SIGTERM to MongoDB process');
      mongoProcess.kill('SIGTERM');
      mongoProcess = null;
    }
  },

  get isRunning(): boolean {
    return mongoProcess !== null;
  },
};
