const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage Queue
class LocalStorageQueue {
  constructor() {
    this.storage = {};
  }

  getItem(key) {
    return this.storage[key] || null;
  }

  setItem(key, value) {
    this.storage[key] = String(value);
  }

  removeItem(key) {
    delete this.storage[key];
  }

  enqueue(item) {
    const raw = this.getItem('offline_queue');
    const queue = raw ? JSON.parse(raw) : [];
    const entry = {
      ...item,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(entry);
    this.setItem('offline_queue', JSON.stringify(queue));
    return entry;
  }

  dequeue(id) {
    const raw = this.getItem('offline_queue');
    const queue = raw ? JSON.parse(raw) : [];
    const updated = queue.filter((i) => i.id !== id);
    this.setItem('offline_queue', JSON.stringify(updated));
  }

  getQueue() {
    const raw = this.getItem('offline_queue');
    return raw ? JSON.parse(raw) : [];
  }

  clear() {
    this.removeItem('offline_queue');
  }
}

describe('Offline Assessment Queue & Sync Suite', () => {
  let queue;

  beforeEach(() => {
    queue = new LocalStorageQueue();
  });

  test('successfully enqueues offline assessment items', () => {
    const item1 = queue.enqueue({
      title: 'Oral Reading Fluency - Juan dela Cruz',
      type: 'reading-assessment',
      url: '/api/teacher/reading/analyze',
      method: 'POST',
      body: { studentId: 'student-1', accuracy: 96 },
    });

    assert.ok(item1.id.startsWith('queue-'));
    assert.equal(queue.getQueue().length, 1);
    assert.equal(queue.getQueue()[0].title, 'Oral Reading Fluency - Juan dela Cruz');
  });

  test('preserves multiple queued entries in FIFO order', () => {
    queue.enqueue({ title: 'Assessment 1', type: 'omr' });
    queue.enqueue({ title: 'Assessment 2', type: 'reading' });
    queue.enqueue({ title: 'Assessment 3', type: 'intervention' });

    const items = queue.getQueue();
    assert.equal(items.length, 3);
    assert.equal(items[0].title, 'Assessment 1');
    assert.equal(items[1].title, 'Assessment 2');
    assert.equal(items[2].title, 'Assessment 3');
  });

  test('dequeues processed items upon successful synchronization', () => {
    const entryA = queue.enqueue({ title: 'Item A' });
    const entryB = queue.enqueue({ title: 'Item B' });

    assert.equal(queue.getQueue().length, 2);

    // Simulate item A synced successfully
    queue.dequeue(entryA.id);

    const remaining = queue.getQueue();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, entryB.id);
  });

  test('clears entire queue upon full sync reset', () => {
    queue.enqueue({ title: 'Item 1' });
    queue.enqueue({ title: 'Item 2' });
    assert.equal(queue.getQueue().length, 2);

    queue.clear();
    assert.equal(queue.getQueue().length, 0);
  });
});
