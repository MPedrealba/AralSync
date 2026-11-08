import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('Dedicated Filipino Reading Teacher Portal & Dual Phil-IRI Framework Suite', async (t) => {

  await t.test('1. Subject & Role Architecture Schema Validation', async () => {
    // models/User.js
    const userModelSrc = fs.readFileSync(path.join(ROOT_DIR, 'models', 'User.js'), 'utf8');
    assert.match(userModelSrc, /'English'/);
    assert.match(userModelSrc, /'Filipino'/);
    assert.match(userModelSrc, /'Reading'/);
    assert.match(userModelSrc, /'Math'/);
    assert.match(userModelSrc, /'Science'/);
    assert.match(userModelSrc, /'All'/);

    // models/Assessment.js
    const assessmentModelSrc = fs.readFileSync(path.join(ROOT_DIR, 'models', 'Assessment.js'), 'utf8');
    assert.match(assessmentModelSrc, /'Filipino'/);
    assert.match(assessmentModelSrc, /'English'/);
    assert.match(assessmentModelSrc, /'Reading - Filipino'/);

    // models/LearningMaterial.js
    const materialModelSrc = fs.readFileSync(path.join(ROOT_DIR, 'models', 'LearningMaterial.js'), 'utf8');
    assert.match(materialModelSrc, /'Filipino'/);
    assert.match(materialModelSrc, /'English'/);

    // models/AnswerKey.js
    const answerKeyModelSrc = fs.readFileSync(path.join(ROOT_DIR, 'models', 'AnswerKey.js'), 'utf8');
    assert.match(answerKeyModelSrc, /'Filipino'/);
    assert.match(answerKeyModelSrc, /'English'/);

    // models/Question.js
    const questionModelSrc = fs.readFileSync(path.join(ROOT_DIR, 'models', 'Question.js'), 'utf8');
    assert.match(questionModelSrc, /'Filipino'/);
    assert.match(questionModelSrc, /'English'/);
  });

  await t.test('2. Dual Phil-IRI Tracking in LearnerRecord Schema', async () => {
    const learnerRecordSrc = fs.readFileSync(path.join(ROOT_DIR, 'models', 'LearnerRecord.js'), 'utf8');
    assert.match(learnerRecordSrc, /philIriEnglish:/);
    assert.match(learnerRecordSrc, /philIriFilipino:/);
    assert.match(learnerRecordSrc, /gstScore/);
    assert.match(learnerRecordSrc, /gstStatus/);
    assert.match(learnerRecordSrc, /oralAccuracy/);
    assert.match(learnerRecordSrc, /Malaya/);
    assert.match(learnerRecordSrc, /Pampagkatuto/);
    assert.match(learnerRecordSrc, /Pagkabigo/);
    assert.match(learnerRecordSrc, /Hindi Makabasa/);
  });

  await t.test('3. Reading Logic Filipino Evaluation Helpers (src/lib/reading.ts)', async () => {
    const {
      readingLevelFilipino,
      comprehensionLevelFilipino,
      combinedReadingLevelFilipino,
      toFilipinoReadingLevel,
    } = await import('../src/lib/reading.ts');

    // 1. toFilipinoReadingLevel mappings
    assert.equal(toFilipinoReadingLevel('Independent'), 'Malaya');
    assert.equal(toFilipinoReadingLevel('Instructional'), 'Pampagkatuto');
    assert.equal(toFilipinoReadingLevel('Frustration'), 'Pagkabigo');
    assert.equal(toFilipinoReadingLevel('Non-Reader'), 'Hindi Makabasa');
    assert.equal(toFilipinoReadingLevel('Malaya'), 'Malaya');

    // 2. Oral reading accuracy evaluation in Filipino
    // Independent (>= 97%)
    assert.equal(readingLevelFilipino(98, 98, 100), 'Malaya');
    // Instructional (90–96%)
    assert.equal(readingLevelFilipino(93, 93, 100), 'Pampagkatuto');
    // Frustration (< 90%)
    assert.equal(readingLevelFilipino(85, 85, 100), 'Pagkabigo');
    // Non-Reader (0 words decoded & attempted > 5)
    assert.equal(readingLevelFilipino(0, 0, 10), 'Hindi Makabasa');

    // 3. Silent comprehension evaluation in Filipino
    // Malaya (>= 80%)
    assert.equal(comprehensionLevelFilipino(85), 'Malaya');
    // Pampagkatuto (59–79%)
    assert.equal(comprehensionLevelFilipino(65), 'Pampagkatuto');
    // Pagkabigo (<= 58%)
    assert.equal(comprehensionLevelFilipino(50), 'Pagkabigo');

    // 4. Combined 4-Quadrant joint evaluation in Filipino
    // Accuracy 98% (Malaya) + Comprehension 85% (Malaya) -> Malaya
    assert.equal(combinedReadingLevelFilipino(98, 85, 98, 100), 'Malaya');
    // Accuracy 98% (Malaya) + Comprehension 70% (Pampagkatuto) -> Pampagkatuto
    assert.equal(combinedReadingLevelFilipino(98, 70, 98, 100), 'Pampagkatuto');
    // Accuracy 92% (Pampagkatuto) + Comprehension 50% (Pagkabigo) -> Pagkabigo
    assert.equal(combinedReadingLevelFilipino(92, 50, 92, 100), 'Pagkabigo');
    // Non-reader -> Hindi Makabasa
    assert.equal(combinedReadingLevelFilipino(0, 0, 0, 10), 'Hindi Makabasa');
  });

  await t.test('4. Dual Phil-IRI Metrics Synchronization (src/lib/philIriSync.ts)', async () => {
    const philIriSyncSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'lib', 'philIriSync.ts'), 'utf8');
    assert.match(philIriSyncSrc, /philIriEnglish/);
    assert.match(philIriSyncSrc, /philIriFilipino/);
    assert.match(philIriSyncSrc, /toFilipinoReadingLevel/);
    assert.match(philIriSyncSrc, /syncLearnerPhilIriMetrics/);
  });

  await t.test('5. DepEd Phil-IRI Filipino Reference Datasets (Grades 7–10)', async () => {
    const {
      PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE,
      buildPhilIriFilipinoSections,
    } = await import('../src/lib/questionnaireSections.ts');

    assert.ok(PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE, 'PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE must be exported');

    // Grade 7 (pp. 134–145)
    const g7 = PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7];
    assert.ok(g7['selection-a'].passageTitle.includes('Isandaang Piso'));
    assert.ok(g7['selection-b'].passageTitle.includes('Gen Z at Millennials'));
    assert.ok(g7['selection-c'].passageTitle.includes('Fiesta Filipinas'));
    assert.ok(g7['selection-d'].passageTitle.includes('Wikang Filipino'));
    assert.equal(g7['selection-d'].referenceType, 'infographic');
    assert.equal(g7['selection-d'].passageImage, '/uploads/materials/infographics/wikang_filipino.png');

    // Grade 8 (pp. 146–156)
    const g8 = PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[8];
    assert.ok(g8['selection-a'].passageTitle.includes('Foul'));
    assert.ok(g8['selection-b'].passageTitle.includes('Pistang Bol-anon'));
    assert.ok(g8['selection-c'].passageTitle.includes('Casa San Miguel'));
    assert.ok(g8['selection-d'].passageTitle.includes('Pneumonia'));
    assert.equal(g8['selection-d'].referenceType, 'infographic');
    assert.equal(g8['selection-d'].passageImage, '/uploads/materials/infographics/doh_pneumonia.png');

    // Grade 9 (pp. 157–167)
    const g9 = PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[9];
    assert.ok(g9['selection-a'].passageTitle.includes('ES-TUD-YAN-TE'));
    assert.ok(g9['selection-b'].passageTitle.includes('Echoserang Palaka'));
    assert.ok(g9['selection-c'].passageTitle.includes('Ink-clusive'));
    assert.ok(g9['selection-d'].passageTitle.includes('Emergency Supply Kit'));
    assert.equal(g9['selection-d'].referenceType, 'infographic');
    assert.equal(g9['selection-d'].passageImage, '/uploads/materials/infographics/emergency_supply_kit.png');

    // Grade 10 (pp. 168–179)
    const g10 = PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[10];
    assert.ok(g10['selection-a'].passageTitle.includes('Abal-abal'));
    assert.ok(g10['selection-b'].passageTitle.includes('Mapa at Direksiyon ng Paglikas'));
    assert.equal(g10['selection-b'].referenceType, 'infographic');
    assert.equal(g10['selection-b'].passageImage, '/uploads/materials/infographics/mapa_ng_paglikas.png');
    assert.ok(g10['selection-c'].passageTitle.includes("'Di Ako Maglalabas"));
    assert.ok(g10['selection-d'].passageTitle.includes('Big C'));
    assert.equal(g10['selection-d'].referenceType, 'infographic');
    assert.equal(g10['selection-d'].passageImage, '/uploads/materials/infographics/big_c_noon_at_ngayon.png');

    // Verify buildPhilIriFilipinoSections
    const g7Sections = buildPhilIriFilipinoSections(7);
    assert.equal(g7Sections.length, 4);
    assert.equal(g7Sections[0].partNumber, 'I');
    assert.ok(g7Sections[0].title.startsWith('BAHAGI I:'));
    assert.ok(g7Sections[0].title.includes('ISANDAANG PISO'));
    assert.equal(g7Sections[0].startItem, 1);
    assert.equal(g7Sections[0].endItem, 10);
    assert.ok(g7Sections[0].instructions.includes('Panuto:'));

    assert.equal(g7Sections[3].partNumber, 'IV');
    assert.ok(g7Sections[3].title.startsWith('BAHAGI IV:'));
    assert.equal(g7Sections[3].startItem, 31);
    assert.equal(g7Sections[3].endItem, 40);
    assert.equal(g7Sections[3].referenceType, 'infographic');
    assert.equal(g7Sections[3].passageImage, '/uploads/materials/infographics/wikang_filipino.png');
  });

  await t.test('6. Python Microservice Document Extraction for Filipino (python-service/app/main.py)', async () => {
    const mainPySrc = fs.readFileSync(path.join(ROOT_DIR, 'python-service', 'app', 'main.py'), 'utf8');
    assert.match(mainPySrc, /PHIL_IRI_FILIPINO_SELECTION_META/);
    assert.match(mainPySrc, /Isandaang Piso/);
    assert.match(mainPySrc, /Foul/);
    assert.match(mainPySrc, /Estudyante/);
    assert.match(mainPySrc, /Abal-abal/);
    assert.match(mainPySrc, /subject:\s*Optional\[str\]/);
    assert.match(mainPySrc, /language:\s*Optional\[str\]/);
  });

  await t.test('7. Teacher Scope and Topics Endpoint for Filipino (teacherScope.ts & topics/route.ts)', async () => {
    const scopeSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'lib', 'teacherScope.ts'), 'utf8');
    assert.match(scopeSrc, /'English'/);
    assert.match(scopeSrc, /'Filipino'/);

    const topicsSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'app', 'api', 'teacher', 'questionnaire', 'topics', 'route.ts'), 'utf8');
    assert.match(topicsSrc, /PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE/);
    assert.match(topicsSrc, /targetSubject === 'Filipino'/);
    assert.match(topicsSrc, /Sipi A:/);
    assert.match(topicsSrc, /Sipi D:/);
  });

  await t.test('8. Navigation Stream Switcher Pill in Top Header (src/components/Header.tsx)', async () => {
    const headerSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'Header.tsx'), 'utf8');
    assert.match(headerSrc, /English Reading/);
    assert.match(headerSrc, /Filipino Reading/);
    assert.match(headerSrc, /handleSwitchStream/);
    assert.match(headerSrc, /aral_reading_stream/);
  });

  await t.test('9. Filipino Branding and Sidebar Navigation (src/components/Sidebar.tsx)', async () => {
    const sidebarSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'Sidebar.tsx'), 'utf8');
    assert.match(sidebarSrc, /filipinoNavSections/);
    assert.match(sidebarSrc, /Tahanan/);
    assert.match(sidebarSrc, /Mga Mag-aaral/);
    assert.match(sidebarSrc, /OMR Pagtatasa/);
    assert.match(sidebarSrc, /Pagbasa/);
    assert.match(sidebarSrc, /Pag-unawa/);
    assert.match(sidebarSrc, /Kasanayan/);
    assert.match(sidebarSrc, /Interbensyon/);
    assert.match(sidebarSrc, /Filipino Reading Teacher/);
  });

  await t.test('10. Filipino Reading Teacher Portal Dashboard View (src/app/dashboard/filipino-reading/page.tsx)', async () => {
    const dashboardFile = path.join(ROOT_DIR, 'src', 'app', 'dashboard', 'filipino-reading', 'page.tsx');
    assert.ok(fs.existsSync(dashboardFile), 'filipino-reading/page.tsx must exist');
    const dashboardSrc = fs.readFileSync(dashboardFile, 'utf8');
    assert.match(dashboardSrc, /AralSync FILIPINO READING TEACHER PORTAL/);
    assert.match(dashboardSrc, /Mga Mag-aaral sa Filipino GST/);
    assert.match(dashboardSrc, /Kailangang Interbensyon/);
    assert.match(dashboardSrc, /Nai-scan na Sagutang Papel/);
    assert.match(dashboardSrc, /Nakabinbing Pagsusuri/);
    assert.match(dashboardSrc, /Panimulang Pagtatasa/);
    assert.match(dashboardSrc, /Mag-scan ng OMR/);
    assert.match(dashboardSrc, /Indibidwal na Pagbasa/);
    assert.match(dashboardSrc, /Pag-unawa sa Binasa/);
  });

  await t.test('11. OMR Assessments Filipino Stream Integration (src/app/dashboard/omr-assessments/page.tsx)', async () => {
    const omrSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx'), 'utf8');
    assert.match(omrSrc, /buildPhilIriFilipinoSections/);
    assert.match(omrSrc, /Sipi A:/);
    assert.match(omrSrc, /Sipi B:/);
    assert.match(omrSrc, /Sipi C:/);
    assert.match(omrSrc, /Sipi D:/);
    assert.match(omrSrc, /Republika ng Pilipinas/i);
    assert.match(omrSrc, /Kagawaran ng Edukasyon/i);
    assert.match(omrSrc, /PANGKALAHATANG PANUTO/i);
    assert.match(omrSrc, /Pakibuklat ang susunod na pahina/i);
  });
});
