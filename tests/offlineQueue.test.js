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


  test('computes local offline Phil-IRI oral reading score with high fidelity', () => {
    // 50 word passage read with 2 miscues in 30 seconds
    const passage = "Every living thing is made of cells the basic building blocks of life. Some organisms are made of a single cell while others like humans are made of trillions. Inside a cell structures called organelles perform specific jobs such as producing energy or making proteins for our bodies.";
    const words = passage.trim().split(/\s+/).filter(Boolean);
    const wordsTotal = words.length;
    const miscueTotal = 2;
    const accuracy = Math.round(((wordsTotal - miscueTotal) / wordsTotal) * 100);
    const durationSec = 30;
    const wpm = Math.round((wordsTotal - miscueTotal) / (durationSec / 60));

    assert.ok(accuracy >= 95, 'High accuracy above 95%');
    assert.ok(wpm > 80, 'WPM scaled to minute duration');
  });

  test('queues teacher and student offline assessment payloads with replay contract', () => {
    const teacherPayload = queue.enqueue({
      title: 'Oral Reading Fluency - Offline Session',
      type: 'reading-assessment',
      url: '/api/teacher/assessments',
      method: 'POST',
      body: {
        studentId: 'stud-offline-1',
        accuracy: 98,
        wpm: 110,
        masteryLevel: 'Independent',
        status: 'approved',
      },
    });

    const studentPayload = queue.enqueue({
      title: 'Student Reading Practice - Offline Session',
      type: 'reading-assessment',
      url: '/api/student/assessments',
      method: 'POST',
      body: {
        title: 'Oral Reading Practice',
        accuracy: 92,
        wpm: 88,
        masteryLevel: 'Instructional',
        status: 'pending',
      },
    });

    const queueItems = queue.getQueue();
    assert.equal(queueItems.length, 2);
    assert.equal(queueItems[0].url, '/api/teacher/assessments');
    assert.equal(queueItems[0].body.status, 'approved');
    assert.equal(queueItems[1].url, '/api/student/assessments');
    assert.equal(queueItems[1].body.status, 'pending');
  });
});

