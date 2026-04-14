import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { z } from 'zod';
import { ValidationError } from '../../middleware/errorHandler.js';

// Expected CSV columns for WeChat Pay reconciliation export
export const reconciliationRowSchema = z.object({
  payment_intent_id: z.string().min(1),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)), 'amount must be numeric'),
  currency: z.string().length(3),
  transaction_date: z.string(),
  signature: z.string().min(1),
});

export type ParsedReconciliationRow = z.infer<typeof reconciliationRowSchema>;

export async function parseCsvBuffer(buffer: Buffer): Promise<ParsedReconciliationRow[]> {
  return new Promise((resolve, reject) => {
    const rows: ParsedReconciliationRow[] = [];
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true });

    parser.on('readable', () => {
      let record: unknown;
      while ((record = parser.read()) !== null) {
        const result = reconciliationRowSchema.safeParse(record);
        if (!result.success) {
          reject(new ValidationError('CSV row validation failed', { issues: result.error.errors, row: record }));
          return;
        }
        rows.push(result.data);
      }
    });

    parser.on('error', (err) => reject(new ValidationError(`CSV parse error: ${err.message}`)));
    parser.on('end', () => resolve(rows));

    Readable.from(buffer).pipe(parser);
  });
}

/**
 * Build the canonical string used to verify a row's signature.
 * Fields must be in deterministic order as specified by the merchant.
 */
export function buildRowSignaturePayload(row: ParsedReconciliationRow): string {
  return `${row.payment_intent_id}|${row.amount}|${row.currency}|${row.transaction_date}`;
}
