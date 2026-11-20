import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Teacher Learner Management Action Safety Suite', () => {
  const root = process.cwd();
  const learnersPagePath = path.join(root, 'src', 'app', 'dashboard', 'learners', 'page.tsx');

  test('1. Trash2 is not imported in teacher learners page', () => {
    const content = fs.readFileSync(learnersPagePath, 'utf-8');
    assert.ok(
      !content.includes('Trash2'),
      'src/app/dashboard/learners/page.tsx must not import or reference Trash2'
    );
  });

  test('2. ActionDropdown does not declare or accept onDelete prop', () => {
    const content = fs.readFileSync(learnersPagePath, 'utf-8');
    assert.ok(
      !content.includes('onDelete'),
      'ActionDropdown must not declare, accept, or invoke onDelete'
    );
  });

  test('3. ActionDropdown contains only View Profile and Edit Details actions', () => {
    const content = fs.readFileSync(learnersPagePath, 'utf-8');
    assert.ok(
      content.includes('View Profile'),
      'ActionDropdown must contain View Profile link'
    );
    assert.ok(
      content.includes('Edit Details'),
      'ActionDropdown must contain Edit Details button'
    );
    assert.ok(
      !content.includes('>Delete<') && !content.includes('> Delete<') && !content.includes('Delete\n'),
      'ActionDropdown must not contain Delete button'
    );
  });
});
