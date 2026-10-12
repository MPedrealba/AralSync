/**
 * Offline Sync Queue Manager for AralSync PWA
 * Safely persists offline assessment entries, OMR scores, and intervention logs
 * in localStorage and replays them when network connectivity is restored.
 */

export interface QueuedSubmission {
  id: string;
  timestamp: number;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  body: any;
  type: 'omr-assessment' | 'reading-assessment' | 'intervention' | 'general';
  title: string;
  studentName?: string;
  retries?: number;
}

const QUEUE_KEY = 'aralsync_offline_queue';

/**
 * Retrieves all pending offline submissions from localStorage.
 */
export function getOfflineQueue(): QueuedSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Adds an offline assessment submission to the local queue.
 */
export function enqueueOfflineSubmission(
  item: Omit<QueuedSubmission, 'id' | 'timestamp' | 'retries'>
): QueuedSubmission {
  const queue = getOfflineQueue();
  const newItem: QueuedSubmission = {
    ...item,
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    retries: 0,
  };

  queue.push(newItem);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('aralsync:queue-updated', { detail: { count: queue.length } }));
  } catch (err) {
    console.error('Failed to save to offline queue:', err);
  }

  return newItem;
}

/**
 * Removes a specific item from the offline queue.
 */
export function dequeueOfflineSubmission(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('aralsync:queue-updated', { detail: { count: queue.length } }));
  } catch (err) {
    console.error('Failed to update offline queue:', err);
  }
}

/**
 * Replays all pending items in the offline queue to the server.
 * Returns the count of successfully synchronized submissions.
 */
export async function syncOfflineQueue(): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0, total: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, total: 0 };
  }

  let synced = 0;
  let failed = 0;
  const remaining: QueuedSubmission[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'X-AralSync-Offline-Replay': 'true',
        },
        body: JSON.stringify(item.body),
      });

      if (res.ok) {
        synced++;
      } else {
        item.retries = (item.retries || 0) + 1;
        // Keep in queue if server error, discard if permanent 4xx (except 429)
        if (res.status === 429 || res.status >= 500 || item.retries < 3) {
          remaining.push(item);
        } else {
          failed++;
        }
      }
    } catch {
      item.retries = (item.retries || 0) + 1;
      remaining.push(item);
      failed++;
    }
  }

  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    window.dispatchEvent(
      new CustomEvent('aralsync:queue-updated', { detail: { count: remaining.length } })
    );
  } catch {
    // ignore
  }

  return { synced, failed, total: queue.length };
}

/**
 * Clears the entire offline queue.
 */
export function clearOfflineQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new CustomEvent('aralsync:queue-updated', { detail: { count: 0 } }));
  } catch {
    // ignore
  }
}
