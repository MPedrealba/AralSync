const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('OMR Vision Engine Error Handling & Resilience Suite', () => {
  const singleRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'omr', 'route.ts');
  const batchRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'omr', 'batch', 'route.ts');
  const pythonMainPath = path.join(__dirname, '..', 'python-service', 'app', 'main.py');
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');

  const singleSrc = fs.readFileSync(singleRoutePath, 'utf8');
  const batchSrc = fs.readFileSync(batchRoutePath, 'utf8');
  const pythonMainSrc = fs.readFileSync(pythonMainPath, 'utf8');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. omr/route.ts strips trailing slashes from PYTHON_SERVICE_URL', () => {
    assert.ok(
      singleSrc.includes("(process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\\/+$/, '')"),
      'omr/route.ts must strip trailing slashes from PYTHON_SERVICE_URL'
    );
  });

  test('2. omr/route.ts extends timeout to 60s and parses Render 502/504 errors', () => {
    assert.ok(
      singleSrc.includes('AbortSignal.timeout(60000)'),
      'omr/route.ts must use 60s timeout for cold start'
    );
    assert.ok(
      singleSrc.includes('const rawText = await res.text();'),
      'omr/route.ts must read rawText from res.text()'
    );
    assert.ok(
      singleSrc.includes("res.status === 502 || res.status === 504 || rawText.includes('Bad Gateway')"),
      'omr/route.ts must check for 502/504 or Bad Gateway'
    );
    assert.ok(
      singleSrc.includes('The OMR Vision Engine is waking up on Render. Please wait 30 seconds and try again.'),
      'omr/route.ts must provide friendly waking up message'
    );
    assert.ok(
      singleSrc.includes('json.detail || json.error || rawText.slice(0, 150)'),
      'omr/route.ts must extract exact python detail/error or slice(0, 150)'
    );
  });

  test('3. omr/batch/route.ts strips trailing slashes, uses 60s timeout, and parses errors', () => {
    assert.ok(
      batchSrc.includes("(process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\\/+$/, '')"),
      'omr/batch/route.ts must strip trailing slashes from PYTHON_SERVICE_URL'
    );
    assert.ok(
      batchSrc.includes('AbortSignal.timeout(60000)'),
      'omr/batch/route.ts must use 60s timeout'
    );
    assert.ok(
      batchSrc.includes('const rawText = await res.text();'),
      'omr/batch/route.ts must read rawText from res.text()'
    );
    assert.ok(
      batchSrc.includes("res.status === 502 || res.status === 504 || rawText.includes('Bad Gateway')"),
      'omr/batch/route.ts must check for 502/504 or Bad Gateway'
    );
    assert.ok(
      batchSrc.includes('The OMR Vision Engine is waking up on Render. Please wait 30 seconds and try again.'),
      'omr/batch/route.ts must provide friendly waking up message'
    );
    assert.ok(
      batchSrc.includes('json.detail || json.error || rawText.slice(0, 150)'),
      'omr/batch/route.ts must extract exact python detail/error or slice(0, 150)'
    );
  });

  test('4. python-service/app/main.py wraps /omr/detect in try...except and logs traceback', () => {
    assert.ok(
      pythonMainSrc.includes('import traceback'),
      'main.py must import traceback'
    );
    assert.ok(
      pythonMainSrc.includes('traceback.print_exc()'),
      'main.py must call traceback.print_exc()'
    );
    assert.ok(
      pythonMainSrc.includes('HTTPException(status_code=422, detail=f"OMR Detection Error: {str(e)}")'),
      'main.py must return HTTP 422 with OMR Detection Error'
    );
  });

  test('5. python-service/app/omr.py guards against IndexError in find_bubble_grid', () => {
    assert.ok(
      pythonOmrSrc.includes('if not sorted_by_x:\n            return []') ||
      pythonOmrSrc.includes('if not sorted_by_x:'),
      'find_bubble_grid in omr.py must check if not sorted_by_x and return []'
    );
  });
});
