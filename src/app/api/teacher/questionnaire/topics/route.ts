import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../database/db';
import Question from '../../../../../../models/Question';
import AnswerKey from '../../../../../../models/AnswerKey';
import User from '../../../../../../models/User';
import LearningMaterial from '../../../../../../models/LearningMaterial';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { PHIL_IRI_REFERENCES_BY_GRADE, PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE } from '@/lib/questionnaireSections';

/**
 * GET /api/teacher/questionnaire/topics
 * Returns official curriculum topics separated by skill from the learning materials,
 * dynamic subject status (Reading active; Math & Science active if materials uploaded),
 * and the list of topics already assessed by the authenticated teacher.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);
    await connectDB();

    // 1. Get teacher profile for subject assignment
    const user = await User.findById(authUser.id)
      .select('assignedSubject specialization')
      .lean();
    const assignedSubject =
      (user as any)?.assignedSubject ||
      ((user as any)?.specialization === 'reading' ? 'Reading' : 'All');

    // 2. Dynamic status check for active learning materials
    const mathMaterialCount = await LearningMaterial.countDocuments({ subject: 'Math', isActive: true });
    const scienceMaterialCount = await LearningMaterial.countDocuments({ subject: 'Science', isActive: true });

    // 3. Fetch distinct topics from official Question Bank or Material for target subject & grade
    const requestedSubject = req.nextUrl.searchParams.get('subject');
    const requestedGrade = Number(req.nextUrl.searchParams.get('grade')) || 7;
    const requestedMaterialId = req.nextUrl.searchParams.get('materialId');

    const targetSubject =
      requestedSubject && requestedSubject !== 'All'
        ? requestedSubject
        : (assignedSubject !== 'All' ? assignedSubject : 'Reading');

    let sortedTopics: string[] = [];
    let coverageItems: any[] = [];

    if (targetSubject === 'Reading' || targetSubject === 'English') {
      const g = requestedGrade >= 7 && requestedGrade <= 10 ? requestedGrade : 7;
      const gradeRefs = PHIL_IRI_REFERENCES_BY_GRADE[g] || PHIL_IRI_REFERENCES_BY_GRADE[7];

      coverageItems = [
        {
          id: 'selection-a',
          letter: 'A',
          name: `Selection A: ${gradeRefs['selection-a'].passageTitle}`,
          topic: gradeRefs['selection-a'].passageTitle,
          type: gradeRefs['selection-a'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-a'].author,
        },
        {
          id: 'selection-b',
          letter: 'B',
          name: `Selection B: ${gradeRefs['selection-b'].passageTitle}`,
          topic: gradeRefs['selection-b'].passageTitle,
          type: gradeRefs['selection-b'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-b'].author,
        },
        {
          id: 'selection-c',
          letter: 'C',
          name: `Selection C: ${gradeRefs['selection-c'].passageTitle}`,
          topic: gradeRefs['selection-c'].passageTitle,
          type: gradeRefs['selection-c'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-c'].author,
        },
        {
          id: 'selection-d',
          letter: 'D',
          name: `Selection D: ${gradeRefs['selection-d'].passageTitle}`,
          topic: gradeRefs['selection-d'].passageTitle,
          type: gradeRefs['selection-d'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-d'].author,
        },
      ];
      sortedTopics = coverageItems.map((c) => c.topic);
    } else if (targetSubject === 'Filipino' || targetSubject === 'Reading - Filipino') {
      const g = requestedGrade >= 7 && requestedGrade <= 10 ? requestedGrade : 7;
      const gradeRefs = PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[g] || PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7];

      coverageItems = [
        {
          id: 'selection-a',
          letter: 'A',
          name: `Sipi A: ${gradeRefs['selection-a'].passageTitle}`,
          topic: gradeRefs['selection-a'].passageTitle,
          type: gradeRefs['selection-a'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-a'].author,
        },
        {
          id: 'selection-b',
          letter: 'B',
          name: `Sipi B: ${gradeRefs['selection-b'].passageTitle}`,
          topic: gradeRefs['selection-b'].passageTitle,
          type: gradeRefs['selection-b'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-b'].author,
        },
        {
          id: 'selection-c',
          letter: 'C',
          name: `Sipi C: ${gradeRefs['selection-c'].passageTitle}`,
          topic: gradeRefs['selection-c'].passageTitle,
          type: gradeRefs['selection-c'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-c'].author,
        },
        {
          id: 'selection-d',
          letter: 'D',
          name: `Sipi D: ${gradeRefs['selection-d'].passageTitle}`,
          topic: gradeRefs['selection-d'].passageTitle,
          type: gradeRefs['selection-d'].referenceType.toUpperCase(),
          count: 10,
          author: gradeRefs['selection-d'].author,
        },
      ];
      sortedTopics = coverageItems.map((c) => c.topic);
    } else {
      const topicFilter: Record<string, any> = { subject: targetSubject };
      if (requestedGrade) {
        topicFilter.gradeLevel = requestedGrade;
      }
      if (requestedMaterialId) {
        topicFilter.materialId = requestedMaterialId;
      }

      const subjectTopics = await Question.distinct('topic', topicFilter);
      sortedTopics = subjectTopics
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .sort((a, b) => a.localeCompare(b));

      // Calculate question count per topic
      const counts = await Question.aggregate([
        { $match: topicFilter },
        { $group: { _id: '$topic', count: { $sum: 1 } } },
      ]);
      const countMap = new Map<string, number>(counts.map((c: any) => [c._id, c.count]));

      coverageItems = sortedTopics.map((t, idx) => ({
        id: `topic-${idx}`,
        letter: undefined,
        name: t,
        topic: t,
        type: targetSubject === 'Math' ? 'COMPETENCY' : 'TOPIC',
        count: countMap.get(t) || 10,
        author: undefined,
      }));

      // Fallback to material's session directory / chapters if Question bank has no questions for this material yet
      if (coverageItems.length === 0 && requestedMaterialId) {
        const mat = await LearningMaterial.findById(requestedMaterialId).lean();
        if (mat?.sessionDirectory && mat.sessionDirectory.length > 0) {
          const sessions = mat.sessionDirectory.filter((s: any) =>
            !s.sessionName.toLowerCase().includes('full') &&
            (!requestedGrade || !s.sessionName.includes('Grade') || s.sessionName.includes(`Grade ${requestedGrade}`))
          );
          const sessionsToUse = sessions.length > 0 ? sessions : mat.sessionDirectory;
          coverageItems = sessionsToUse.map((s: any, idx: number) => ({
            id: `session-${idx}`,
            letter: undefined,
            name: s.sessionName,
            topic: s.topic || s.sessionName,
            type: targetSubject === 'Math' ? 'CHAPTER' : 'TOPIC',
            count: 10,
            author: undefined,
          }));
          sortedTopics = coverageItems.map((c) => c.topic);
        }
      }
    }

    // 4. Find topics this specific teacher has already generated an assessment for
    const teacherAnswerKeys = await AnswerKey.find({
      teacherId: authUser.id,
      topic: { $exists: true, $ne: '' },
    })
      .select('topic title created')
      .sort({ created: -1 })
      .lean();

    const usedTopics = Array.from(
      new Set(
        teacherAnswerKeys
          .map((k: any) => k.topic)
          .filter((t): t is string => Boolean(t && typeof t === 'string'))
      )
    );

    const subjects = [
      {
        id: 'Reading',
        name: 'Reading',
        status: 'active',
        source: 'DepEd ARAL Workbooks (KS1, KS2, KS3)',
        bubbleSheetUrl: '/bubble-sheets/reading-bubble.pdf',
      },
      {
        id: 'Math',
        name: 'Mathematics',
        status: mathMaterialCount > 0 ? 'active' : 'locked',
        ...(mathMaterialCount > 0
          ? { source: 'DepEd ARAL Math Workbooks' }
          : { notice: 'Official Math ARAL learning material PDFs pending upload by coordinator/admin.' }),
        bubbleSheetUrl: '/bubble-sheets/mathematics-bubble.pdf',
      },
      {
        id: 'Science',
        name: 'Science',
        status: scienceMaterialCount > 0 ? 'active' : 'locked',
        ...(scienceMaterialCount > 0
          ? { source: 'DepEd ARAL Science Workbooks' }
          : { notice: 'Official Science ARAL learning material PDFs pending upload by coordinator/admin.' }),
        bubbleSheetUrl: '/bubble-sheets/science-bubble.pdf',
      },
    ];

    return NextResponse.json({
      success: true,
      assignedSubject,
      targetSubject,
      grade: requestedGrade,
      subjects,
      topics: sortedTopics,
      coverageItems,
      usedTopics,
      totalAvailableTopics: sortedTopics.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Questionnaire Topics GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
