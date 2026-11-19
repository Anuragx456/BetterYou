import { BodyMeasurement } from '../../types';
import { getDatabase } from '../client';

export interface BodyMeasurementSqlRow {
  id: string;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: number;
}

function parseBodyMeasurementRow(r: BodyMeasurementSqlRow): BodyMeasurement {
  return {
    id: r.id,
    date: r.date,
    weightKg: r.weight_kg,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  };
}

export async function dbInsertBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO body_measurements (id, date, weight_kg, note, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      measurement.id,
      measurement.date,
      measurement.weightKg,
      measurement.note ?? null,
      measurement.createdAt || Date.now(),
    ]
  );
}

export async function dbGetAllBodyMeasurements(): Promise<BodyMeasurement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<BodyMeasurementSqlRow>(
    'SELECT * FROM body_measurements ORDER BY date DESC, created_at DESC'
  );
  return rows.map(parseBodyMeasurementRow);
}

export async function dbGetBodyMeasurementsByDateRange(
  startDate: string,
  endDate: string
): Promise<BodyMeasurement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<BodyMeasurementSqlRow>(
    'SELECT * FROM body_measurements WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC',
    [startDate, endDate]
  );
  return rows.map(parseBodyMeasurementRow);
}

export async function dbGetLatestBodyMeasurement(): Promise<BodyMeasurement | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<BodyMeasurementSqlRow>(
    'SELECT * FROM body_measurements ORDER BY date DESC, created_at DESC LIMIT 1'
  );
  if (!row) return null;
  return parseBodyMeasurementRow(row);
}

export async function dbDeleteBodyMeasurement(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM body_measurements WHERE id = ?', [id]);
}
