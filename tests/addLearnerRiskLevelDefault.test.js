const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Coordinator AddLearnerModal Automatic Pending Assessment Default Suite', () => {
  const modalPath = path.join(__dirname, '..', 'src', 'components', 'AddLearnerModal.tsx');
  const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'coordinator', 'learners', 'route.ts');

  const modalContent = fs.readFileSync(modalPath, 'utf8');
  const routeContent = fs.readFileSync(routePath, 'utf8');

  test('1. AddLearnerModal removes manual Risk Level input and label', () => {
    // Assert that there is NO "Risk Level" label or select dropdown in the modal UI
    assert.ok(
      !/<label[^>]*>\s*Risk Level\s*<\/label>/i.test(modalContent),
      'AddLearnerModal must not contain a "Risk Level" label'
    );
    assert.ok(
      !/<select[^>]*value=\{riskLevel\}/i.test(modalContent),
      'AddLearnerModal must not contain a select dropdown for riskLevel'
    );
  });

  test('2. AddLearnerModal initializes and submits riskLevel as "Pending Assessment"', () => {
    assert.ok(
      modalContent.includes('useState("Pending Assessment")'),
      'AddLearnerModal must initialize riskLevel state to "Pending Assessment"'
    );
    assert.ok(
      modalContent.includes('riskLevel,'),
      'AddLearnerModal must pass riskLevel in the payload'
    );
  });

  test('3. API route defaults new learner riskLevel to "Pending Assessment"', () => {
    assert.ok(
      routeContent.includes("riskLevel: riskLevel || 'Pending Assessment'"),
      'Coordinator learners API route must default riskLevel to "Pending Assessment"'
    );
  });
});
