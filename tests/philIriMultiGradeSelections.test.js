const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Phil-IRI Multi-Grade (7–10) Selections & Chapter Filtering Suite', () => {
  const publicDir = path.resolve(__dirname, '..', 'public');
  const infographicsDir = path.join(publicDir, 'uploads', 'materials', 'infographics');

  describe('Infographic Physical Assets', () => {
    test('all 4 grade-level infographic PNG images exist and have valid file sizes', () => {
      const expectedAssets = [
        { grade: 7, file: 'solid_waste_management.png' },
        { grade: 8, file: 'deforestation.png' },
        { grade: 9, file: 'aneurysm.png' },
        { grade: 10, file: 'transforming_agriculture.png' },
      ];

      expectedAssets.forEach(({ grade, file }) => {
        const fullPath = path.join(infographicsDir, file);
        assert.ok(fs.existsSync(fullPath), `Missing infographic file for Grade ${grade}: ${file}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 10000, `Infographic file for Grade ${grade} is too small (${stat.size} bytes): ${file}`);
      });
    });
  });

  describe('TypeScript Reference Material Definitions (questionnaireSections.ts)', () => {
    test('defines PHIL_IRI_REFERENCES_BY_GRADE with authentic texts for all 4 grades', () => {
      const qSectionsPath = path.join(__dirname, '..', 'src', 'lib', 'questionnaireSections.ts');
      const content = fs.readFileSync(qSectionsPath, 'utf8');

      assert.ok(content.includes('PHIL_IRI_REFERENCES_BY_GRADE'), 'Must export PHIL_IRI_REFERENCES_BY_GRADE');
      assert.ok(content.includes("Africa's Plea"), 'Must contain Grade 8 Selection A "Africa\'s Plea"');
      assert.ok(content.includes('Dinagsa Festival: Colorful Hues of Gaiety'), 'Must contain Grade 8 Selection B');
      assert.ok(content.includes('The Negro Speaks of Rivers'), 'Must contain Grade 8 Selection C');
      assert.ok(content.includes('Deforestation'), 'Must contain Grade 8 Selection D');

      assert.ok(content.includes('The Road Not Taken'), 'Must contain Grade 9 Selection A "The Road Not Taken"');
      assert.ok(content.includes('Depression: How Serious Can It Get?'), 'Must contain Grade 9 Selection B');
      assert.ok(content.includes('Tsunamis'), 'Must contain Grade 9 Selection C');
      assert.ok(content.includes('Brain Aneurysms'), 'Must contain Grade 9 Selection D');

      assert.ok(content.includes('Still I Rise'), 'Must contain Grade 10 Selection A "Still I Rise"');
      assert.ok(content.includes('Mental Health, Too'), 'Must contain Grade 10 Selection B');
      assert.ok(content.includes('Arachne'), 'Must contain Grade 10 Selection C');
      assert.ok(content.includes('Transforming Philippine Agriculture'), 'Must contain Grade 10 Selection D');
    });

    test('buildPhilIriSections supports dynamic grade levels 7, 8, 9, 10', () => {
      const qSectionsPath = path.join(__dirname, '..', 'src', 'lib', 'questionnaireSections.ts');
      const content = fs.readFileSync(qSectionsPath, 'utf8');

      assert.ok(content.includes('export function buildPhilIriSections'), 'Must export buildPhilIriSections');
      assert.ok(content.includes('export function buildPhilIriG8Sections'), 'Must export buildPhilIriG8Sections');
      assert.ok(content.includes('export function buildPhilIriG9Sections'), 'Must export buildPhilIriG9Sections');
      assert.ok(content.includes('export function buildPhilIriG10Sections'), 'Must export buildPhilIriG10Sections');
    });
  });

  describe('Python Document Parser Extraction across Grades 7–10', () => {
    const pyExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    const manualPdf = path.join(publicDir, 'uploads', 'materials', 'aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf');

    test('PyMuPDF extractor partitions 4 selections & 40 questions for Grades 7, 8, 9, 10', () => {
      if (!fs.existsSync(pyExe) || !fs.existsSync(manualPdf)) return;

      const pyCode = [
        "import asyncio, sys, os",
        "sys.path.insert(0, os.path.abspath('python-service'))",
        "from app.main import extract_document_text, ExtractDocumentRequest",
        "async def test_grades():",
        "    for g in [7, 8, 9, 10]:",
        "        req = ExtractDocumentRequest(file_path='public/uploads/materials/aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf', grade=g)",
        "        res = await extract_document_text(req)",
        "        assert res['success'] == True",
        "        passages = res['passages']",
        "        assert len(passages) == 4, f'Grade {g} expected 4 passages, got {len(passages)}'",
        "        total_q = sum(len(p.get('questions', [])) for p in passages)",
        "        assert total_q == 40, f'Grade {g} expected 40 questions, got {total_q}'",
        "    print('ALL_GRADES_PARSED_40_OK')",
        "asyncio.run(test_grades())"
      ].join('\\n');

      const out = execSync(`"${pyExe}" -c "exec('''${pyCode}''')"`, { encoding: 'utf8' });
      assert.ok(out.includes('ALL_GRADES_PARSED_40_OK'), 'Extraction failed: ' + out);
    });

    test('verifies accurate answer keys for Grade 8, 9, 10 from Key to Correction pages', () => {
      if (!fs.existsSync(pyExe) || !fs.existsSync(manualPdf)) return;

      const pyCode = [
        "import asyncio, sys, os",
        "sys.path.insert(0, os.path.abspath('python-service'))",
        "from app.main import extract_document_text, ExtractDocumentRequest",
        "async def check_keys():",
        "    # Grade 8: Q1 Africa's Plea answer is B (Literal)",
        "    r8 = await extract_document_text(ExtractDocumentRequest(file_path='public/uploads/materials/aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf', grade=8))",
        "    q1_8 = r8['passages'][0]['questions'][0]",
        "    assert q1_8.get('correctAnswer') == 'B', 'G8 Q1 expected B, got ' + str(q1_8.get('correctAnswer'))",
        "    assert q1_8['domain'] == 'Literal'",
        "    # Grade 9: Q1 Road Not Taken answer is B (Literal)",
        "    r9 = await extract_document_text(ExtractDocumentRequest(file_path='public/uploads/materials/aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf', grade=9))",
        "    q1_9 = r9['passages'][0]['questions'][0]",
        "    assert q1_9.get('correctAnswer') == 'B', 'G9 Q1 expected B, got ' + str(q1_9.get('correctAnswer'))",
        "    # Grade 10: Q1 Still I Rise answer is B (Literal)",
        "    r10 = await extract_document_text(ExtractDocumentRequest(file_path='public/uploads/materials/aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf', grade=10))",
        "    q1_10 = r10['passages'][0]['questions'][0]",
        "    assert q1_10.get('correctAnswer') == 'B', 'G10 Q1 expected B, got ' + str(q1_10.get('correctAnswer'))",
        "    print('KEYS_VERIFIED_OK')",
        "asyncio.run(check_keys())"
      ].join('\\n');

      const out = execSync(`"${pyExe}" -c "exec('''${pyCode}''')"`, { encoding: 'utf8' });
      assert.ok(out.includes('KEYS_VERIFIED_OK'), 'Key verification failed: ' + out);
    });
  });

  describe('API Route Grade Isolation & Single Selection Filtering (generate-reading/route.ts)', () => {
    const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate-reading', 'route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    test('Question.find and ReadingPassage.find strictly filter by both materialId and gradeLevel', () => {
      assert.ok(content.includes('materialId: materialDoc._id'), 'Must query by materialId');
      assert.ok(content.includes('gradeLevel: gradeLevel'), 'Must query by gradeLevel');
    });

    test('Question.findOneAndUpdate and ReadingPassage.findOneAndUpdate isolate by gradeLevel', () => {
      assert.ok(
        content.includes('{ materialId: materialDoc._id, gradeLevel, title: p.title }'),
        'ReadingPassage upsert must include gradeLevel'
      );
      assert.ok(
        content.includes('{ materialId: materialDoc._id, gradeLevel, prompt: q.prompt }'),
        'Question upsert must include gradeLevel'
      );
    });

    test('supports single selection filtering via requestedLetter / selectionLetter', () => {
      assert.ok(content.includes('requestedLetter'), 'Must handle requestedLetter parameter');
      assert.ok(content.includes('selectionLetter'), 'Must read selectionLetter from request body');
    });

    test('builds authentic sections using buildPhilIriSections(gradeLevel)', () => {
      assert.ok(content.includes('buildPhilIriSections(gradeLevel)'), 'Must call buildPhilIriSections with gradeLevel');
    });
  });

  describe('Frontend Section / Chapter Filter & Reading Selection (omr-assessments/page.tsx)', () => {
    const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    test('declares selectedReadingSelection and philIriSelectionOptions for Curriculum Bank', () => {
      assert.ok(content.includes('selectedReadingSelection'), 'Must have selectedReadingSelection state');
      assert.ok(content.includes('philIriSelectionOptions'), 'Must compute philIriSelectionOptions for the selected grade');
      assert.ok(content.includes('Reading Selection / Material Section'), 'Must render selector label in UI');
    });

    test('passes selectionLetter and sessionName to /api/teacher/questionnaire/generate-reading', () => {
      assert.ok(content.includes('selectionLetter: selectedReadingSelection !== "all"'), 'Must pass selectionLetter in POST body');
      assert.ok(content.includes('sessionName: selectedReadingSelection !== "all"'), 'Must pass sessionName in POST body');
    });

    test('filters Session Directory / Chapter options strictly to selected grade in extract mode', () => {
      assert.ok(content.includes('Session Directory / Chapter (Grade {grade})'), 'Must show Grade-specific session label');
      assert.ok(content.includes('nameAndTopic.includes(`Grade ${grade}`)'), 'Must filter sessions to current grade');
    });

    test('sanitizeDoc invokes buildPhilIriSections with document gradeLevel', () => {
      assert.ok(content.includes('buildPhilIriSections(d.gradeLevel'), 'sanitizeDoc must use buildPhilIriSections with doc gradeLevel');
    });
  });
});
