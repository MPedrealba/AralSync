import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("User Management Safety & Button State Suite", () => {
  it("locks teacher account deletion unless safety confirmation is explicitly checked", () => {
    const isTeacher = true;
    let deleteBusy = false;
    let confirmTeacherDelete = false;

    // Disabled when safety lock is unchecked
    let isDeleteDisabled = deleteBusy || (isTeacher && !confirmTeacherDelete);
    assert.equal(isDeleteDisabled, true);

    // Enabled once safety lock is checked
    confirmTeacherDelete = true;
    isDeleteDisabled = deleteBusy || (isTeacher && !confirmTeacherDelete);
    assert.equal(isDeleteDisabled, false);

    // Disabled when in-flight request is busy
    deleteBusy = true;
    isDeleteDisabled = deleteBusy || (isTeacher && !confirmTeacherDelete);
    assert.equal(isDeleteDisabled, true);
  });

  it("does not require safety checkbox for non-teacher accounts", () => {
    const isTeacher = false;
    const deleteBusy = false;
    const confirmTeacherDelete = false;

    const isDeleteDisabled = deleteBusy || (isTeacher && !confirmTeacherDelete);
    assert.equal(isDeleteDisabled, false);
  });

  it("enforces mandatory fields for Add Staff modal", () => {
    const validateAddStaff = (name, username, saving = false) => {
      return saving || !name.trim() || !username.trim();
    };

    assert.equal(validateAddStaff("", ""), true);
    assert.equal(validateAddStaff("   ", "teacher1"), true);
    assert.equal(validateAddStaff("Maria Santos", "   "), true);
    assert.equal(validateAddStaff("Maria Santos", "msantos", false), false);
    assert.equal(validateAddStaff("Maria Santos", "msantos", true), true);
  });

  it("enforces mandatory fields for Edit User Account modal", () => {
    const validateEditUser = (name, username, editingSave = false) => {
      return editingSave || !name.trim() || !username.trim();
    };

    assert.equal(validateEditUser("", "user1"), true);
    assert.equal(validateEditUser("User One", ""), true);
    assert.equal(validateEditUser("User One", "user1", false), false);
    assert.equal(validateEditUser("User One", "user1", true), true);
  });

  it("enforces mandatory fields for Learner Enrollment modal", () => {
    const validateAddLearner = (lrn, name, section, isCustom, customText, loading = false) => {
      const finalSection = (isCustom ? customText : section).trim();
      return loading || !lrn.trim() || !name.trim() || !finalSection;
    };

    assert.equal(validateAddLearner("", "Juan", "Emerald", false, ""), true);
    assert.equal(validateAddLearner("102938475612", "", "Emerald", false, ""), true);
    assert.equal(validateAddLearner("102938475612", "Juan", "", false, ""), true);
    assert.equal(validateAddLearner("102938475612", "Juan", "Emerald", true, "   "), true);
    assert.equal(validateAddLearner("102938475612", "Juan", "Emerald", true, "CustomSectionA"), false);
    assert.equal(validateAddLearner("102938475612", "Juan", "Emerald", false, ""), false);
  });

  it("enforces mandatory fields for Batch Assignment application", () => {
    const validateBatchApply = (readingId, mathId, scienceId, isCustom, customText, isApplying = false) => {
      return (
        isApplying ||
        (!readingId && !mathId && !scienceId) ||
        (isCustom && !customText.trim())
      );
    };

    // No teachers selected
    assert.equal(validateBatchApply("", "", "", false, ""), true);

    // Reading teacher selected with preset section
    assert.equal(validateBatchApply("teacher123", "", "", false, ""), false);

    // Reading teacher selected with custom section toggled but empty custom input
    assert.equal(validateBatchApply("teacher123", "", "", true, "   "), true);

    // Reading teacher selected with custom section filled
    assert.equal(validateBatchApply("teacher123", "", "", true, "Diamond"), false);
  });
});
