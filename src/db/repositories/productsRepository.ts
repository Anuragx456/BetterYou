import { ScannedProduct, ToxicityReport } from '../../types';
import { getLocalDateString } from '../../utils/date';
import { getDatabase } from '../client';

function parseScannedProductRow(r: {
  id: string;
  barcode: string | null;
  product_name: string;
  scanned_at: string;
  image_path: string | null;
  report_json: string;
}): ScannedProduct {
  let report: ToxicityReport;
  try {
    report = JSON.parse(r.report_json);
  } catch {
    report = {
      productName: r.product_name,
      overallSafetyScore: 50,
      riskLevel: 'Moderate',
      harmfulIngredients: [],
      cleanSummary: '',
    };
  }

  return {
    id: r.id,
    barcode: r.barcode ?? undefined,
    productName: r.product_name,
    scannedAt: r.scanned_at,
    imageUrl: r.image_path ?? undefined,
    report,
    reportComplete: true,
  };
}

interface ProductSummarySqlRow {
  id: string;
  barcode: string | null;
  product_name: string;
  overall_safety_score: number;
  risk_level: string;
  scanned_at: string;
  image_path: string | null;
  flagged_count?: number | null;
}

function mapProductSummary(r: ProductSummarySqlRow): ScannedProduct {
  const riskLevel =
    r.risk_level === 'Safe' || r.risk_level === 'Moderate' || r.risk_level === 'High Risk'
      ? r.risk_level
      : 'Moderate';

  return {
    id: r.id,
    barcode: r.barcode ?? undefined,
    productName: r.product_name,
    scannedAt: r.scanned_at,
    imageUrl: r.image_path ?? undefined,
    reportComplete: false,
    flaggedCount: Number(r.flagged_count ?? 0),
    report: {
      productName: r.product_name,
      overallSafetyScore: r.overall_safety_score,
      riskLevel,
      harmfulIngredients: [],
      cleanSummary: '',
    },
  };
}

export async function dbInsertScannedProduct(product: ScannedProduct): Promise<void> {
  const db = await getDatabase();
  const date = getLocalDateString(product.scannedAt);
  const now = Date.now();
  const name = product.productName || product.report?.productName || 'Unknown Product';
  const img = product.imageUrl ?? null;

  await db.runAsync(
    `INSERT OR REPLACE INTO scanned_products (
      id, date, barcode, product_name, category, overall_safety_score, risk_level, scanned_at, image_path, report_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      date,
      product.barcode ?? null,
      name,
      product.report.category ?? null,
      product.report.overallSafetyScore,
      product.report.riskLevel,
      product.scannedAt,
      img,
      JSON.stringify(product.report),
      now,
    ]
  );
}

export async function dbGetAllScannedProducts(): Promise<ScannedProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    barcode: string | null;
    product_name: string;
    scanned_at: string;
    image_path: string | null;
    report_json: string;
  }>('SELECT * FROM scanned_products ORDER BY scanned_at DESC LIMIT 100');

  return rows.map(parseScannedProductRow);
}

/**
 * List rows for the dashboard and the all-scans modal.
 * Leaves report_json on disk so startup does not JSON.parse every scan.
 */
export async function dbGetProductSummaries(limit = 100): Promise<ScannedProduct[]> {
  const db = await getDatabase();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db.getAllAsync<ProductSummarySqlRow>(
    `SELECT id, barcode, product_name, overall_safety_score, risk_level, scanned_at, image_path,
            COALESCE(json_array_length(report_json, '$.harmfulIngredients'), 0) AS flagged_count
     FROM scanned_products
     ORDER BY scanned_at DESC
     LIMIT ${safeLimit}`
  );
  return rows.map(mapProductSummary);
}

export async function dbGetScannedProductById(id: string): Promise<ScannedProduct | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    barcode: string | null;
    product_name: string;
    scanned_at: string;
    image_path: string | null;
    report_json: string;
  }>(
    'SELECT id, barcode, product_name, scanned_at, image_path, report_json FROM scanned_products WHERE id = ?',
    [id]
  );
  if (!row) return null;
  return parseScannedProductRow(row);
}

export async function dbGetScannedProductsByDate(date: string): Promise<ScannedProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    barcode: string | null;
    product_name: string;
    scanned_at: string;
    image_path: string | null;
    report_json: string;
  }>('SELECT * FROM scanned_products WHERE date = ? ORDER BY scanned_at DESC', [date]);

  return rows.map(parseScannedProductRow);
}

export async function dbDeleteScannedProduct(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM scanned_products WHERE id = ?', [id]);
}

export async function dbGetAllProductImagePaths(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ image_path: string | null }>(
    'SELECT image_path FROM scanned_products WHERE image_path IS NOT NULL'
  );
  return rows.map((r) => r.image_path).filter((p): p is string => Boolean(p));
}
