const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Import the logic tested for dynamic material scanning and learner proficiency resolution
describe('Dynamic Material Recommendations Engine', () => {
  // Test grade extraction
  function extractGrades(title, existingGrades) {
    if (Array.isArray(existingGrades) && existingGrades.length > 0) {
      return existingGrades;
    }
    const match = title.match(/Grade[s]?\s*(\d+)(?:\s*(?:to|&|-)\s*(\d+))?/i);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      const grades = [];
      for (let g = start; g <= end; g++) {
        grades.push(g);
      }
      return grades;
    }
    return [7];
  }

  // Proficiency resolution logic
  function resolveLearnerProficiency(learner, subject, score) {
    if (score != null) {
      if (score < 50) {
        return {
          tier: subject === 'Reading' ? 'Frustration' : 'Beginning',
          progLevel: 'Basic',
        };
      }
      if (score < 75) {
        return {
          tier: subject === 'Reading' ? 'Instructional' : 'Developing',
          progLevel: 'Plus',
        };
      }
      return {
        tier: subject === 'Reading' ? 'Independent' : 'Proficient',
        progLevel: 'Plus',
      };
    }

    if (subject === 'Reading') {
      const rLevel =
        learner?.combinedReadingLevel ||
        learner?.readingLevel ||
        learner?.comprehensionLevel ||
        learner?.oralReadingLevel;

      if (rLevel === 'Non-Reader' || rLevel === 'Frustration') {
        return { tier: 'Frustration', progLevel: 'Basic' };
      }
      if (rLevel === 'Instructional') {
        return { tier: 'Instructional', progLevel: 'Plus' };
      }
      if (rLevel === 'Independent') {
        return { tier: 'Independent', progLevel: 'Plus' };
      }
    }

    const mStatus = learner?.masteryStatus;
    const risk = learner?.riskLevel;

    if (mStatus === 'Beginning' || risk === 'High Risk') {
      return {
        tier: subject === 'Reading' ? 'Frustration' : 'Beginning',
        progLevel: 'Basic',
      };
    }
    if (mStatus === 'Developing' || mStatus === 'Approaching' || risk === 'Moderate Risk') {
      return {
        tier: subject === 'Reading' ? 'Instructional' : 'Developing',
        progLevel: 'Plus',
      };
    }
    if (mStatus === 'Proficient' || risk === 'Low Risk') {
      return {
        tier: subject === 'Reading' ? 'Independent' : 'Proficient',
        progLevel: 'Plus',
      };
    }

    return {
      tier: subject === 'Reading' ? 'Instructional' : 'Developing',
      progLevel: 'Plus',
    };
  }

  // Recommendation generator simulator
  function generateDynamicRecs(material, passages = []) {
    const rawSubject = material.subject || 'General';
    let subject = 'Math';
    if (rawSubject === 'Reading' || /reading|english|filipino|literacy/i.test(material.title)) {
      subject = 'Reading';
    } else if (rawSubject === 'Science' || /science/i.test(material.title)) {
      subject = 'Science';
    }

    const grades = extractGrades(material.title, material.gradeLevels);
    const keyStage = material.keyStage && material.keyStage !== 'General'
      ? material.keyStage
      : grades[0] >= 7
      ? 'KS3'
      : grades[0] >= 4
      ? 'KS2'
      : 'KS1';

    const sessions = Array.isArray(material.sessionDirectory) ? material.sessionDirectory : [];
    const items = [];

    if (sessions.length > 0) {
      const totalSessions = sessions.length;
      sessions.forEach((sess, idx) => {
        let progLevel = 'Plus';
        let tier = subject === 'Reading' ? 'Instructional' : 'Developing';

        if (idx === 0 || /intro|basic|foundat|review/i.test(sess.topic || sess.sessionName)) {
          progLevel = 'Basic';
          tier = subject === 'Reading' ? 'Frustration' : 'Beginning';
        } else if (idx === totalSessions - 1 || /mastery|advanc|eval/i.test(sess.topic || sess.sessionName)) {
          progLevel = 'Plus';
          tier = subject === 'Reading' ? 'Independent' : 'Proficient';
        }

        let kind = 'Activity';
        if (/quiz|assessment|evaluat|check/i.test(sess.topic || sess.sessionName)) {
          kind = 'Quiz';
        } else if (/module|lesson|unit/i.test(sess.topic || sess.sessionName)) {
          kind = 'Module';
        }

        items.push({
          title: `${material.title} — ${sess.sessionName}${sess.topic ? ': ' + sess.topic : ''}`,
          kind,
          subject,
          source: `${material.title} (${sess.sessionName})`,
          workbookUrl: material.fileUrl,
          keyStage,
          programLevel: progLevel,
          proficiencyTier: tier,
          targetGrades: grades,
          pageStart: sess.pageStart,
          pageEnd: sess.pageEnd,
          sessionInfo: sess.sessionName,
          isDynamic: true,
        });
      });

      if (sessions.length === 1) {
        items.push({
          title: `${material.title} — Core Skill Application (Tier 2)`,
          kind: 'Module',
          subject,
          source: material.title,
          workbookUrl: material.fileUrl,
          keyStage,
          programLevel: 'Plus',
          proficiencyTier: subject === 'Reading' ? 'Instructional' : 'Developing',
          targetGrades: grades,
          pageStart: 16,
          pageEnd: 35,
          sessionInfo: 'Core Application Tier',
          isDynamic: true,
        });
        items.push({
          title: `${material.title} — Advanced Mastery & Synthesis (Tier 3)`,
          kind: 'Quiz',
          subject,
          source: material.title,
          workbookUrl: material.fileUrl,
          keyStage,
          programLevel: 'Plus',
          proficiencyTier: subject === 'Reading' ? 'Independent' : 'Proficient',
          targetGrades: grades,
          pageStart: 36,
          pageEnd: null,
          sessionInfo: 'Mastery Tier',
          isDynamic: true,
        });
      }
    } else {
      items.push({
        title: `${material.title} — Guided Foundational Remediation (Tier 1)`,
        kind: 'Activity',
        subject,
        source: material.title,
        workbookUrl: material.fileUrl,
        keyStage,
        programLevel: 'Basic',
        proficiencyTier: subject === 'Reading' ? 'Frustration' : 'Beginning',
        targetGrades: grades,
        pageStart: 1,
        pageEnd: 15,
        sessionInfo: 'Foundational Tier',
        isDynamic: true,
      });
      items.push({
        title: `${material.title} — Core Skill Application & Exercises (Tier 2)`,
        kind: 'Module',
        subject,
        source: material.title,
        workbookUrl: material.fileUrl,
        keyStage,
        programLevel: 'Plus',
        proficiencyTier: subject === 'Reading' ? 'Instructional' : 'Developing',
        targetGrades: grades,
        pageStart: 16,
        pageEnd: 35,
        sessionInfo: 'Core Application Tier',
        isDynamic: true,
      });
      items.push({
        title: `${material.title} — Advanced Mastery & Problem Solving (Tier 3)`,
        kind: 'Quiz',
        subject,
        source: material.title,
        workbookUrl: material.fileUrl,
        keyStage,
        programLevel: 'Plus',
        proficiencyTier: subject === 'Reading' ? 'Independent' : 'Proficient',
        targetGrades: grades,
        pageStart: 36,
        pageEnd: null,
        sessionInfo: 'Mastery Tier',
        isDynamic: true,
      });
    }

    // Process reading passages
    for (const passage of passages) {
      const qCount = Array.isArray(passage.questions) ? passage.questions.length : 0;
      const isBasic = qCount <= 4;
      items.push({
        title: `Reading Selection: ${passage.title}`,
        kind: qCount > 0 ? 'Quiz' : 'Activity',
        subject: 'Reading',
        source: passage.sourceMaterial || passage.title,
        workbookUrl: material.fileUrl,
        keyStage: passage.keyStage || 'KS3',
        programLevel: isBasic ? 'Basic' : 'Plus',
        proficiencyTier: isBasic ? 'Instructional' : 'Independent',
        targetGrades: [passage.gradeLevel || 7],
        sessionInfo: 'Reading Selection',
        isDynamic: true,
      });
    }

    return items;
  }

  it('correctly extracts grade ranges from titles when gradeLevels is empty', () => {
    assert.deepEqual(extractGrades('ARAL Math Worksheet Grade 7 & 8', []), [7, 8]);
    assert.deepEqual(extractGrades('Math Leaner Workbook Grade 9 to 10', []), [9, 10]);
    assert.deepEqual(extractGrades('Reading Workbook Grade 7', []), [7]);
    assert.deepEqual(extractGrades('General Science Workbook', []), [7]); // fallback
  });

  it('generates 3 calibrated tiers when workbook has no session directory', () => {
    const material = {
      title: 'Reading Wokrbook Grade 7',
      subject: 'Reading',
      gradeLevels: [7],
      keyStage: 'KS3',
      fileUrl: '/uploads/materials/reading-g7.pdf',
      sessionDirectory: [],
    };

    const recs = generateDynamicRecs(material);
    assert.equal(recs.length, 3);

    // Tier 1
    assert.equal(recs[0].proficiencyTier, 'Frustration');
    assert.equal(recs[0].programLevel, 'Basic');
    assert.equal(recs[0].pageStart, 1);
    assert.equal(recs[0].pageEnd, 15);
    assert.equal(recs[0].workbookUrl, '/uploads/materials/reading-g7.pdf');

    // Tier 2
    assert.equal(recs[1].proficiencyTier, 'Instructional');
    assert.equal(recs[1].programLevel, 'Plus');
    assert.equal(recs[1].pageStart, 16);
    assert.equal(recs[1].pageEnd, 35);

    // Tier 3
    assert.equal(recs[2].proficiencyTier, 'Independent');
    assert.equal(recs[2].programLevel, 'Plus');
    assert.equal(recs[2].pageStart, 36);
  });

  it('maps introductory session to Beginning / Basic and creates higher tiers for full coverage', () => {
    const material = {
      title: 'ARAL Math Worksheet Grade 7 & 8',
      subject: 'Math',
      gradeLevels: [7, 8, 9, 10],
      keyStage: 'KS3',
      fileUrl: '/uploads/materials/math-g78.pdf',
      sessionDirectory: [
        {
          sessionName: 'Session 1',
          pageStart: 1,
          pageEnd: 50,
          topic: 'Introductory Exercises',
        },
      ],
    };

    const recs = generateDynamicRecs(material);
    assert.equal(recs.length, 3);

    // Session 1 is introductory -> Beginning / Basic
    assert.equal(recs[0].proficiencyTier, 'Beginning');
    assert.equal(recs[0].programLevel, 'Basic');
    assert.equal(recs[0].sessionInfo, 'Session 1');
    assert.deepEqual(recs[0].targetGrades, [7, 8, 9, 10]);

    // Core Tier is available
    assert.equal(recs[1].proficiencyTier, 'Developing');
    assert.equal(recs[1].programLevel, 'Plus');

    // Mastery Tier is available
    assert.equal(recs[2].proficiencyTier, 'Proficient');
    assert.equal(recs[2].programLevel, 'Plus');
  });

  it('converts ReadingPassage documents into dynamic reading activities/quizzes', () => {
    const material = {
      title: 'Reading Workbook Grade 7',
      subject: 'Reading',
      gradeLevels: [7],
      keyStage: 'KS3',
      fileUrl: '/uploads/materials/reading-g7.pdf',
      sessionDirectory: [],
    };
    const passages = [
      {
        title: 'Daisy and the Gold Can',
        gradeLevel: 7,
        keyStage: 'KS3',
        questions: [{ q: 1 }, { q: 2 }, { q: 3 }, { q: 4 }],
        sourceMaterial: 'Reading Workbook Grade 7 — LAS #28',
      },
      {
        title: 'The Van and the Yard',
        gradeLevel: 7,
        keyStage: 'KS3',
        questions: [{ q: 1 }, { q: 2 }, { q: 3 }, { q: 4 }, { q: 5 }, { q: 6 }],
        sourceMaterial: 'Reading Workbook Grade 7 — LAS #38',
      },
    ];

    const recs = generateDynamicRecs(material, passages);
    const passageRecs = recs.filter((r) => r.sessionInfo === 'Reading Selection');
    assert.equal(passageRecs.length, 2);

    // <= 4 questions -> Instructional / Basic Activity
    assert.equal(passageRecs[0].proficiencyTier, 'Instructional');
    assert.equal(passageRecs[0].programLevel, 'Basic');
    assert.equal(passageRecs[0].kind, 'Quiz');

    // > 4 questions -> Independent / Plus Quiz
    assert.equal(passageRecs[1].proficiencyTier, 'Independent');
    assert.equal(passageRecs[1].programLevel, 'Plus');
  });

  it('resolves learner proficiency based on assessment score', () => {
    // Math: Low score (< 50) -> Beginning / Basic
    assert.deepEqual(resolveLearnerProficiency(null, 'Math', 42), {
      tier: 'Beginning',
      progLevel: 'Basic',
    });

    // Math: Moderate score (50-74) -> Developing / Plus
    assert.deepEqual(resolveLearnerProficiency(null, 'Math', 65), {
      tier: 'Developing',
      progLevel: 'Plus',
    });

    // Math: High score (>= 75) -> Proficient / Plus
    assert.deepEqual(resolveLearnerProficiency(null, 'Math', 88), {
      tier: 'Proficient',
      progLevel: 'Plus',
    });

    // Reading: Low score (< 50) -> Frustration / Basic
    assert.deepEqual(resolveLearnerProficiency(null, 'Reading', 40), {
      tier: 'Frustration',
      progLevel: 'Basic',
    });

    // Reading: Moderate score (50-74) -> Instructional / Plus
    assert.deepEqual(resolveLearnerProficiency(null, 'Reading', 70), {
      tier: 'Instructional',
      progLevel: 'Plus',
    });

    // Reading: High score (>= 75) -> Independent / Plus
    assert.deepEqual(resolveLearnerProficiency(null, 'Reading', 95), {
      tier: 'Independent',
      progLevel: 'Plus',
    });
  });

  it('resolves learner proficiency based on Phil-IRI reading profile when score is absent', () => {
    const student1 = { readingLevel: 'Non-Reader', gradeLevel: 7 };
    assert.deepEqual(resolveLearnerProficiency(student1, 'Reading'), {
      tier: 'Frustration',
      progLevel: 'Basic',
    });

    const student2 = { combinedReadingLevel: 'Instructional', gradeLevel: 7 };
    assert.deepEqual(resolveLearnerProficiency(student2, 'Reading'), {
      tier: 'Instructional',
      progLevel: 'Plus',
    });

    const student3 = { readingLevel: 'Independent', gradeLevel: 7 };
    assert.deepEqual(resolveLearnerProficiency(student3, 'Reading'), {
      tier: 'Independent',
      progLevel: 'Plus',
    });
  });

  it('resolves learner proficiency based on masteryStatus and riskLevel for Math', () => {
    const studentStruggling = { riskLevel: 'High Risk', masteryStatus: 'Beginning' };
    assert.deepEqual(resolveLearnerProficiency(studentStruggling, 'Math'), {
      tier: 'Beginning',
      progLevel: 'Basic',
    });

    const studentDeveloping = { riskLevel: 'Moderate Risk', masteryStatus: 'Developing' };
    assert.deepEqual(resolveLearnerProficiency(studentDeveloping, 'Math'), {
      tier: 'Developing',
      progLevel: 'Plus',
    });

    const studentProficient = { riskLevel: 'Low Risk', masteryStatus: 'Proficient' };
    assert.deepEqual(resolveLearnerProficiency(studentProficient, 'Math'), {
      tier: 'Proficient',
      progLevel: 'Plus',
    });
  });
});
