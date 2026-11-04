import { describe, it, expect, beforeEach } from 'bun:test';
import {
  enqueueOfflineScan,
  getQueuedScans,
  removeQueuedScan,
  clearQueuedScans,
  processOfflineScanQueue,
} from '../scanQueueService';

describe('Offline Scan Queue Service (scanQueueService.ts)', () => {
  beforeEach(async () => {
    await clearQueuedScans();
  });

  it('enqueues pending scans to persistent storage', async () => {
    const item = await enqueueOfflineScan('meal', 'images/meals/sample_meal.jpg');
    expect(item.id).toBeDefined();
    expect(item.type).toBe('meal');
    expect(item.imagePath).toBe('images/meals/sample_meal.jpg');
    expect(item.status).toBe('pending');

    const queued = await getQueuedScans();
    expect(queued.length).toBe(1);
    expect(queued[0].id).toBe(item.id);
  });

  it('removes processed scan items by ID', async () => {
    const item1 = await enqueueOfflineScan('meal', 'images/meals/1.jpg');
    const item2 = await enqueueOfflineScan('toxicity', 'images/products/2.jpg');

    let queued = await getQueuedScans();
    expect(queued.length).toBe(2);

    await removeQueuedScan(item1.id);
    queued = await getQueuedScans();
    expect(queued.length).toBe(1);
    expect(queued[0].id).toBe(item2.id);
  });

  it('idempotently returns zero processed count when queue is empty', async () => {
    const result = await processOfflineScanQueue();
    expect(result.processedCount).toBe(0);
    expect(result.succeededCount).toBe(0);
  });
});
