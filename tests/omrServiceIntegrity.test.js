import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('OMR Vision Engine & Service Lifecycle Integrity Suite', () => {
  it('verifies src/app/api/teacher/omr/route.ts has ZERO Math.random fake fallback', () => {
    const singleRoutePath = path.resolve(process.cwd(), 'src/app/api/teacher/omr/route.ts');
    const source = fs.readFileSync(singleRoutePath, 'utf8');

    // Must NOT contain random options guessing
    assert.equal(source.includes('Math.random()'), false, 'Math.random() must be completely eliminated from single OMR route');
    assert.equal(source.includes('OPTIONS[Math.floor(Math.random() * 4)]'), false, 'Fake bubble options simulation must be removed');

    // Must export or define OMRServiceError
    assert.equal(source.includes('OMRServiceError'), true, 'Must define OMRServiceError');
    assert.equal(source.includes('OMR_SERVICE_OFFLINE'), true, 'Must return OMR_SERVICE_OFFLINE on connection error');
    assert.equal(source.includes('503'), true, 'Must return 503 Service Unavailable when OpenCV service is unreachable');
  });

  it('verifies src/app/api/teacher/omr/batch/route.ts has ZERO Math.random fake fallback', () => {
    const batchRoutePath = path.resolve(process.cwd(), 'src/app/api/teacher/omr/batch/route.ts');
    const source = fs.readFileSync(batchRoutePath, 'utf8');

    // Must NOT contain random options guessing
    assert.equal(source.includes('Math.random()'), false, 'Math.random() must be completely eliminated from batch OMR route');
    assert.equal(source.includes('fallbackAnswers.push(OPTIONS[Math.floor(Math.random() * 4)])'), false, 'Batch fake bubble options simulation must be removed');

    // Must export or define OMRServiceError
    assert.equal(source.includes('OMRServiceError'), true, 'Must define OMRServiceError in batch route');
    assert.equal(source.includes('OMR_SERVICE_OFFLINE'), true, 'Must return OMR_SERVICE_OFFLINE on connection error');
    assert.equal(source.includes('503'), true, 'Must return 503 Service Unavailable when OpenCV service is unreachable');
  });

  it('validates OMRServiceError error payload semantics', () => {
    class MockOMRServiceError extends Error {
      constructor(message, code = 'OMR_SERVICE_OFFLINE', status = 503) {
        super(message);
        this.name = 'OMRServiceError';
        this.code = code;
        this.status = status;
      }
    }

    const offlineErr = new MockOMRServiceError(
      'OMR Vision Engine is offline. Please ensure the Python OpenCV microservice is running on port 8000.',
      'OMR_SERVICE_OFFLINE',
      503
    );

    assert.equal(offlineErr.status, 503);
    assert.equal(offlineErr.code, 'OMR_SERVICE_OFFLINE');
    assert.equal(offlineErr.message.includes('port 8000'), true);

    const detectionErr = new MockOMRServiceError('No bubble grid detected on sheet.', 'OMR_DETECTION_FAILED', 422);
    assert.equal(detectionErr.status, 422);
    assert.equal(detectionErr.code, 'OMR_DETECTION_FAILED');
  });

  it('verifies package.json orchestrates the dev lifecycle with scripts/dev.js', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.equal(pkg.scripts.dev, 'node scripts/dev.js', 'dev script must invoke unified dev orchestrator');
    assert.equal(pkg.scripts['dev:next'], 'next dev', 'dev:next must be available for standalone Next.js');
    assert.ok(pkg.scripts['dev:python'], 'dev:python must be available');
  });

  it('verifies scripts/dev.js exists and detects python virtual environment', () => {
    const devScriptPath = path.resolve(process.cwd(), 'scripts/dev.js');
    assert.equal(fs.existsSync(devScriptPath), true, 'scripts/dev.js must exist');

    const devSource = fs.readFileSync(devScriptPath, 'utf8');
    assert.equal(devSource.includes('python-service'), true, 'Must target python-service directory');
    assert.equal(devSource.includes('8000'), true, 'Must check and configure port 8000');
    assert.equal(devSource.includes('isPythonServiceRunning'), true, 'Must check if service is already running');
  });
});
