/**
 * Sets the auto-cancel and auto-close timestamps on an order at creation/transition time.
 * The actual cancellation/closure is performed by autoCancelJob and autoCloseJob (cron jobs).
 *
 * Config (from environment):
 *   ORDER_AUTO_CANCEL_MINUTES  — minutes after submission before unpaid orders are cancelled (default 30)
 *   ORDER_AUTO_CLOSE_DAYS      — days after delivery before orders are closed (default 14)
 */
export const orderScheduler = {
  /**
   * Returns the `autoCancelAt` timestamp to set when an order is submitted.
   */
  getAutoCancelAt(): Date {
    const minutes = Number(process.env['ORDER_AUTO_CANCEL_MINUTES'] ?? '30');
    const dt = new Date();
    dt.setMinutes(dt.getMinutes() + minutes);
    return dt;
  },

  /**
   * Returns the `autoCloseAt` timestamp to set when an order reaches `delivered`.
   */
  getAutoCloseAt(): Date {
    const days = Number(process.env['ORDER_AUTO_CLOSE_DAYS'] ?? '14');
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt;
  },
};
