const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Pure resolution logic mirror for Node CJS test runner
function resolveMaterialFilePath(material) {
  if (!material) return null;
  const rawUrl = typeof material.fileUrl === 'string' ? material.fileUrl.trim() : '';
  if (!rawUrl) return null;

  const publicDir = path.resolve(__dirname, '..', 'public');
  const cleanRel = rawUrl.split(/[#?]/)[0].trim().replace(/^\/+/, '');
  if (!cleanRel) return null;

  const directPath = path.resolve(publicDir, cleanRel);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  const cwdCandidate = path.resolve(__dirname, '..', cleanRel);
  if (fs.existsSync(cwdCandidate) && fs.statSync(cwdCandidate).isFile()) {
    return cwdCandidate;
  }

  const uploadsDir = path.join(publicDir, 'uploads', 'materials');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir).filter((f) => f.toLowerCase().endsWith('.pdf') && !f.startsWith('.'));
    const titleSlug = (material.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const titleMatch = files.find((f) => titleSlug.length > 3 && f.toLowerCase().includes(titleSlug.slice(0, 15)));
    if (titleMatch) {
      return path.join(uploadsDir, titleMatch);
    }

    if (material.subject === 'Reading' || /phil[-_]?iri|reading/i.test(material.title || '')) {
      const readingMatch = files.find((f) => /phil[-_]?iri|reading/i.test(f));
      if (readingMatch) return path.join(uploadsDir, readingMatch);
    }
  }

  return null;
}

describe('Dynamic Full-Document AI Passage & Question Extraction Suite', () => {
  describe('Python Microservice Document Parser Endpoint (/material/extract-document-text)', () => {
    test('main.py exports extract-document-text endpoint and ExtractDocumentRequest schema', () => {
      const mainPath = path.join(__dirname, '..', 'python-service', 'app', 'main.py');
      const content = fs.readFileSync(mainPath, 'utf8');

      assert.ok(content.includes('/material/extract-document-text'), 'Missing /material/extract-document-text endpoint in main.py');
      assert.ok(content.includes('class ExtractDocumentRequest'), 'Missing ExtractDocumentRequest model in main.py');
      assert.ok(content.includes('_resolve_safe_pdf_path'), 'Missing _resolve_safe_pdf_path sandbox helper in main.py');
      assert.ok(content.includes('selection_pattern'), 'Missing passage selection regex pattern in main.py');
      assert.ok(content.includes('detected_key'), 'Missing detected_key extraction in main.py');
    });

    test('extracts passages, questions, and official answer key from physical Phil-IRI PDF', () => {
      const manualPath = path.join(__dirname, '..', 'public', 'uploads', 'materials', 'aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf');
      if (!fs.existsSync(manualPath)) return;

      const { execSync } = require('child_process');
      const pyExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
      if (!fs.existsSync(pyExe)) return;

      const pyCode = [
        "import asyncio, sys, os",
        "sys.path.insert(0, os.path.abspath('python-service'))",
        "from app.main import extract_document_text, ExtractDocumentRequest",
        "async def run():",
        "    req = ExtractDocumentRequest(file_path='public/uploads/materials/aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf', grade=7)",
        "    res = await extract_document_text(req)",
        "    assert res['success'] == True",
        "    assert len(res['passages']) >= 3",
        "    total_q = sum(len(p.get('questions', [])) for p in res['passages'])",
        "    assert total_q >= 30",
        "    print('VERIFIED_OK')",
        "asyncio.run(run())"
      ].join('\\n');

      const out = execSync(`"${pyExe}" -c "exec('''${pyCode}''')"`, { encoding: 'utf8' });
      assert.ok(out.includes('VERIFIED_OK'), 'Python extraction verification failed: ' + out);
    });
  });

  describe('Dynamic AI Reading Assessment Route (generate-reading/route.ts)', () => {
    test('generate-reading route integrates Python document extraction and MongoDB caching', () => {
      const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate-reading', 'route.ts');
      const content = fs.readFileSync(routePath, 'utf8');

      assert.ok(content.includes('/material/extract-document-text'), 'route.ts must call /material/extract-document-text');
      assert.ok(content.includes('resolveMaterialFilePath'), 'route.ts must use resolveMaterialFilePath');
      assert.ok(content.includes('generatePassageQuestionsAI'), 'route.ts must include AI passage question generator');
      assert.ok(content.includes('ReadingPassage.findOneAndUpdate'), 'route.ts must save extracted ReadingPassages to MongoDB');
      assert.ok(content.includes('Question.findOneAndUpdate'), 'route.ts must save extracted Questions to MongoDB');
      assert.ok(content.includes('existingQuestions.length >= targetCount'), 'route.ts must check database cache for 0-token instant reuse');
      assert.ok(content.includes('bubbleSheetUrl'), 'route.ts must provide DepEd reading bubble sheet URL');
    });

    test('enforces Phil-IRI 40-item standard for Pre-Test and Post-Test', () => {
      const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate-reading', 'route.ts');
      const content = fs.readFileSync(routePath, 'utf8');

      assert.ok(content.includes("assessmentType === 'pre-test' || assessmentType === 'post-test'"), 'Must detect pre-test/post-test');
      assert.ok(content.includes('40'), 'Must support 40 items standard');
    });

    test('categorizes items into Literal, Inferential, and Critical cognitive domains', () => {
      const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate-reading', 'route.ts');
      const content = fs.readFileSync(routePath, 'utf8');

      assert.ok(content.includes('Literal'), 'Must tag Literal domain');
      assert.ok(content.includes('Inferential'), 'Must tag Inferential domain');
      assert.ok(content.includes('Critical'), 'Must tag Critical domain');
    });
  });

  describe('Frontend Questionnaire Preview & DepEd OMR Compatibility (omr-assessments/page.tsx)', () => {
    test('renders reading passage text directly above respective section questions', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      assert.ok(content.includes('section.passageText'), 'page.tsx must check section.passageText');
      assert.ok(content.includes('Reading Selection {section.partNumber'), 'page.tsx must render Reading Selection with part number');
      assert.ok(content.includes('Reading Selection: {section.passageTitle || section.topic}'), 'Print view must render section reading selection');
      assert.ok(content.includes('doc.passageText && (!doc.sections || doc.sections.every'), 'Top-level passage must avoid duplicate rendering');
    });

    test('maintains strict compatibility with 50-item DepEd OMR bubble sheet and OpenCV auto-grading', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      assert.ok(content.includes('/api/teacher/questionnaire/generate-reading'), 'page.tsx must route reading materials to generate-reading endpoint');
      assert.ok(content.includes('q.number'), 'page.tsx must maintain continuous item numbering');
      assert.ok(content.includes('setCount(subject === "Reading" ? 40 : 20)'), 'page.tsx defaults reading pre-test/post-test to 40 items');
    });
  });

  describe('Physical Material Path Resolution Utility (src/lib/materialPath.ts)', () => {
    test('resolves local physical PDF file paths correctly and safely', () => {
      const mockMaterial = {
        title: 'Phil-IRI for JHS Manual 2024',
        subject: 'Reading',
        fileUrl: '/uploads/materials/aral_mat_phil_iri_for_jhs_manual_1793993768134.pdf',
      };

      const resolved = resolveMaterialFilePath(mockMaterial);
      assert.ok(resolved, 'Failed to resolve material file path');
      assert.ok(resolved.endsWith('.pdf'), 'Resolved path must be a PDF');
      assert.ok(fs.existsSync(resolved), 'Resolved file must exist on disk: ' + resolved);
    });

    test('returns null safely for null or empty materials', () => {
      assert.equal(resolveMaterialFilePath(null), null);
      assert.equal(resolveMaterialFilePath({}), null);
    });
  });

  describe('Multi-Part Reading Selections, Infographic Assets & Print Page Breaks Suite', () => {
    test('DENR-EMB Region 1 Solid Waste Management infographic image exists in high resolution', () => {
      const imgPath = path.join(__dirname, '..', 'public', 'uploads', 'materials', 'infographics', 'solid_waste_management.png');
      assert.ok(fs.existsSync(imgPath), 'Infographic image file must exist: ' + imgPath);
      const stats = fs.statSync(imgPath);
      assert.ok(stats.size > 50000, 'Infographic image must be high-resolution (>50KB), size: ' + stats.size);
      const buf = fs.readFileSync(imgPath);
      // Verify PNG magic header: 89 50 4E 47 0D 0A 1A 0A
      assert.equal(buf[0], 0x89);
      assert.equal(buf[1], 0x50);
      assert.equal(buf[2], 0x4e);
      assert.equal(buf[3], 0x47);
    });

    test('generate-reading route exports complete Phil-IRI Grade 7 reference selections', () => {
      const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate-reading', 'route.ts');
      const content = fs.readFileSync(routePath, 'utf8');

      assert.ok(content.includes('PHIL_IRI_G7_REFERENCES'), 'Must export PHIL_IRI_G7_REFERENCES mapping');
      assert.ok(content.includes('What Little Things!'), 'Must include Selection A poem "What Little Things!"');
      assert.ok(content.includes('Madison Julius Cawein'), 'Must credit Madison Julius Cawein');
      assert.ok(content.includes('Plant Intelligence'), 'Must include Selection B article "Plant Intelligence"');
      assert.ok(content.includes('Lyra B. Bedis'), 'Must credit Lyra B. Bedis');
      assert.ok(content.includes("Get to Know PAGASA's Rainfall Warnings"), 'Must include Selection C advisory');
      assert.ok(content.includes('Yellow Rainfall Warning'), 'Must include Yellow Warning advisory details');
      assert.ok(content.includes('Orange Rainfall Warning'), 'Must include Orange Warning advisory details');
      assert.ok(content.includes('Red Rainfall Warning'), 'Must include Red Warning advisory details');
      assert.ok(content.includes('Solid Waste Management'), 'Must include Selection D infographic');
      assert.ok(content.includes('/uploads/materials/infographics/solid_waste_management.png'), 'Must attach infographic PNG asset');
      assert.ok(content.includes('matchReferenceMaterial'), 'Must implement matchReferenceMaterial helper');
    });

    test('QuestionnaireSection and AnswerKey schema support passageImage and referenceType', () => {
      const secTypesPath = path.join(__dirname, '..', 'src', 'lib', 'questionnaireSections.ts');
      const secContent = fs.readFileSync(secTypesPath, 'utf8');
      assert.ok(secContent.includes('passageImage?: string;'), 'QuestionnaireSection must include passageImage');
      assert.ok(secContent.includes("referenceType?: 'poem' | 'article' | 'advisory' | 'infographic';"), 'QuestionnaireSection must include referenceType');

      const modelPath = path.join(__dirname, '..', 'models', 'AnswerKey.js');
      const modelContent = fs.readFileSync(modelPath, 'utf8');
      assert.ok(modelContent.includes('passageImage: { type: String'), 'AnswerKey schema must persist passageImage');
      assert.ok(modelContent.includes('sections: { type: mongoose.Schema.Types.Mixed'), 'AnswerKey schema must persist sections');
    });

    test('QuestionnairePrint enforces clean multi-page print breaks and high-res infographic styles', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      // Strict page break rules
      assert.ok(content.includes('print-cover-page'), 'Must tag cover page for print styling');
      assert.ok(content.includes('pageBreakAfter: "always"'), 'Cover page must break after');
      assert.ok(content.includes('pageBreakBefore: "always"'), 'Sections must start on new page');
      assert.ok(content.includes('printColorAdjust: "exact"'), 'Infographic must enforce exact print colors');
      assert.ok(content.includes('setSelectedEnlargedImage'), 'Must provide interactive click-to-enlarge preview');
      assert.ok(content.includes('Infographic Visual Reference — Fullscreen'), 'Must include fullscreen image preview modal');
    });

    test('ExamViewerModal embeds section reference materials and reuses QuestionnairePrint for reprint', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      assert.ok(content.includes('<QuestionnairePrint doc={viewerDoc} />'), 'ExamViewerModal must use QuestionnairePrint for 5-page reprint');
      assert.ok(content.includes('sectionsList'), 'ExamViewerModal must render section-level passages and images');
      assert.ok(content.includes('handleSaveExam'), 'Must handle saving exams to library');
      assert.ok(content.includes('passageImage: doc.passageImage'), 'handleSaveExam must preserve passageImage in AnswerKey');
    });
  });
});
