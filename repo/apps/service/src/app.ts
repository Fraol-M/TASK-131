import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import { auditEmitterMiddleware } from './middleware/auditEmitter.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

// Route modules (registered after middleware stack)
import { authRouter } from './modules/auth/authRouter.js';
import { usersRouter } from './modules/users/usersRouter.js';
import { catalogRouter } from './modules/catalog/catalogRouter.js';
import { vendorsRouter } from './modules/catalog/vendorsRouter.js';
import { cartsRouter } from './modules/orders/cartsRouter.js';
import { ordersRouter } from './modules/orders/ordersRouter.js';
import { approvalsRouter } from './modules/approvals/approvalsRouter.js';
import { fulfillmentRouter } from './modules/fulfillment/fulfillmentRouter.js';
import { paymentIntentsRouter } from './modules/payments/paymentIntentsRouter.js';
import { reconciliationRouter } from './modules/reconciliation/reconciliationRouter.js';
import { refundsRouter } from './modules/payments/refundsRouter.js';
import { rmaRouter } from './modules/afterSales/rmaRouter.js';
import { reasonCodeRouter } from './modules/afterSales/reasonCodeRouter.js';
import { rulesRouter } from './rules/rulesRouter.js';
import { notificationsRouter } from './modules/notifications/notificationsRouter.js';
import { searchRouter } from './modules/search/searchRouter.js';
import { auditRouter } from './modules/audit/auditRouter.js';
import { backupsRouter } from './modules/backupRestore/backupsRouter.js';
import { restoreRouter } from './modules/backupRestore/restoreRouter.js';
import { settingsRouter } from './modules/settings/settingsRouter.js';
import { updatesRouter } from './updates/updatesRouter.js';
import { systemRouter } from './modules/system/systemRouter.js';

const log = createModuleLogger('app');

export function createApp(): express.Application {
  const app = express();

  // ─── Security middleware ───────────────────────────────────────────────────
  app.use(helmet());

  // CORS origin allowlist:
  //   - Dev: Vite dev server (http://localhost:5173 / http://127.0.0.1:5173)
  //   - Packaged Electron: renderer loads from file:// which the browser reports as
  //     Origin: null. Service binds to 127.0.0.1 only, so accepting null here is safe.
  const CORS_ALLOWED_ORIGINS = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'null', // packaged Electron file:// renderer
  ]);
  app.use(cors({
    origin: (origin, callback) => {
      // origin is undefined for same-origin or non-browser callers (e.g. curl, internal fetch)
      if (!origin || CORS_ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Request enrichment ───────────────────────────────────────────────────
  app.use(auditEmitterMiddleware);

  // ─── Route registration ───────────────────────────────────────────────────
  // Each route group applies: auth → rbac → validate → handler
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/vendors', vendorsRouter);
  app.use('/api/carts', cartsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/fulfillment', fulfillmentRouter);
  app.use('/api/payments/intents', paymentIntentsRouter);
  app.use('/api/payments/reconciliation', reconciliationRouter);
  app.use('/api/refunds', refundsRouter);
  app.use('/api/rma', rmaRouter);
  app.use('/api/reason-codes', reasonCodeRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/audits', auditRouter);
  app.use('/api/backups', backupsRouter);
  app.use('/api/restore', restoreRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/updates', updatesRouter);
  app.use('/api/system', systemRouter);

  // ─── Error handler (must be last) ─────────────────────────────────────────
  app.use(errorHandler);

  log.info('Express app configured');
  return app;
}
