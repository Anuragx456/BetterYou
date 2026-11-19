import { getDatabase } from '../client';

export interface CorrectionEntry {
  id: string;
  type: 'meal' | 'toxicity';
  originalJson: string;
  correctedJson: string;
  timestamp: number;
}

export async function dbInsertCorrection(entry: {
  id?: string;
  type: 'meal' | 'toxicity';
  originalJson: string;
  correctedJson: string;
  timestamp?: number;
}): Promise<CorrectionEntry> {
  const db = await getDatabase();
  const id = entry.id || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = entry.timestamp || Date.now();

  await db.runAsync(
    `INSERT OR REPLACE INTO corrections (id, type, original_json, corrected_json, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [id, entry.type, entry.originalJson, entry.correctedJson, timestamp]
  );

  return {
    id,
    type: entry.type,
    originalJson: entry.originalJson,
    correctedJson: entry.correctedJson,
    timestamp,
  };
}

export async function dbGetAllCorrections(type?: 'meal' | 'toxicity'): Promise<CorrectionEntry[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM corrections ORDER BY timestamp DESC';
  const params: unknown[] = [];
  if (type) {
    sql = 'SELECT * FROM corrections WHERE type = ? ORDER BY timestamp DESC';
    params.push(type);
  }

  const rows = await db.getAllAsync<{
    id: string;
    type: 'meal' | 'toxicity';
    original_json: string;
    corrected_json: string;
    timestamp: number;
  }>(sql, params);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    originalJson: r.original_json,
    correctedJson: r.corrected_json,
    timestamp: r.timestamp,
  }));
}

export async function dbClearCorrections(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM corrections;');
}
