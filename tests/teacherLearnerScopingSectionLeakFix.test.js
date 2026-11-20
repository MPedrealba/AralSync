const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Teacher Learner Scoping & Cross-Teacher Section Leak Fix Suite', () => {
  const dashboardRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'dashboard', 'route.ts');
  const learnersRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'learners', 'route.ts');
  const autoAssignRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'interventions', 'auto-assign', 'route.ts');
  const gstRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'gst', 'route.ts');

  const dashboardSrc = fs.readFileSync(dashboardRoutePath, 'utf8');
  const learnersSrc = fs.readFileSync(learnersRoutePath, 'utf8');
  const autoAssignSrc = fs.readFileSync(autoAssignRoutePath, 'utf8');
  const gstSrc = fs.readFileSync(gstRoutePath, 'utf8');

  test('1. dashboard/route.ts eliminates teacherSections and broad section $in matching', () => {
    assert.ok(
      !dashboardSrc.includes('teacherSections'),
      'dashboard route must NOT contain teacherSections'
    );
    assert.ok(
      !dashboardSrc.includes('section: { $in'),
      'dashboard route must NOT contain section: { $in'
    );
    assert.ok(
      dashboardSrc.includes("'assignedTeachers.reading'") &&
      dashboardSrc.includes("'assignedTeachers.math'") &&
      dashboardSrc.includes("'assignedTeachers.science'"),
      'dashboard route must scope to teacher assignments'
    );
  });

  test('2. learners/route.ts eliminates teacherSections and broad section $in matching', () => {
    assert.ok(
      !learnersSrc.includes('teacherSections'),
      'learners route must NOT contain teacherSections'
    );
    assert.ok(
      !learnersSrc.includes('section: { $in'),
      'learners route must NOT contain section: { $in'
    );
    assert.ok(
      learnersSrc.includes("filter: Record<string, unknown> = {\n      $or: teacherMatchConditions,") ||
      learnersSrc.includes("$or: teacherMatchConditions"),
      'learners route must strictly scope filter.$or to teacherMatchConditions'
    );
  });

  test('3. auto-assign/route.ts eliminates teacherSections and broad section $in matching', () => {
    assert.ok(
      !autoAssignSrc.includes('teacherSections'),
      'auto-assign route must NOT contain teacherSections'
    );
    assert.ok(
      !autoAssignSrc.includes('section: { $in'),
      'auto-assign route must NOT contain section: { $in'
    );
    assert.ok(
      autoAssignSrc.includes('LearnerRecord.find({ $or: teacherMatchConditions })'),
      'auto-assign route must find learners strictly matching teacherMatchConditions'
    );
  });

  test('4. gst/route.ts eliminates teacherSections and scopes both filter and allSections dropdown', () => {
    assert.ok(
      !gstSrc.includes('teacherSections'),
      'gst route must NOT contain teacherSections'
    );
    assert.ok(
      !gstSrc.includes('section: { $in'),
      'gst route must NOT contain section: { $in'
    );
    assert.ok(
      gstSrc.includes('$or: teacherMatchConditions'),
      'gst route must strictly enforce $or: teacherMatchConditions on filter and allSections'
    );
  });
});
