import React from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import LoginPage from './modules/auth/LoginPage.js';
import OrdersPage from './modules/orders/OrdersPage.js';
import OrderDetailWindow from './modules/orders/OrderDetailWindow.js';
import CartPage from './modules/orders/CartPage.js';
import CatalogPage from './modules/catalog/CatalogPage.js';
import ApprovalsPage from './modules/approvals/ApprovalsPage.js';
import RulesPage from './modules/rules/RulesPage.js';
import AuditViewerPage from './modules/audit/AuditViewerPage.js';
import ReconciliationWindow from './modules/payments/ReconciliationWindow.js';
import UpdateManagerPage from './modules/updates/UpdateManagerPage.js';
import NotificationsPage from './modules/notifications/NotificationsPage.js';
import BackupRestorePage from './modules/backupRestore/BackupRestorePage.js';
import { RequireAuth } from './modules/auth/RequireAuth.js';

export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      { index: true, element: <Navigate to="/orders" replace /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'order-detail', element: <OrderDetailWindow /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'approvals', element: <ApprovalsPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'audit', element: <AuditViewerPage /> },
      { path: 'reconciliation', element: <ReconciliationWindow /> },
      { path: 'updates', element: <UpdateManagerPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'backup-restore', element: <BackupRestorePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/orders" replace /> },
]);
