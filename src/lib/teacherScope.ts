import User from '../../models/User';

export type TeacherSubject = 'Reading' | 'Math' | 'Science' | 'English' | 'Filipino' | 'All';

/**
 * Resolves the logged-in teacher's assigned subject according to DepEd ARAL rules:
 * - If assignedSubject === "Reading" (or specialization === "reading"), strictly scope to "Reading".
 * - If assignedSubject === "English", scope to "English".
 * - If assignedSubject === "Filipino", scope to "Filipino".
 * - If assignedSubject === "Math", strictly scope to "Math".
 * - If assignedSubject === "Science", strictly scope to "Science".
 * - If assignedSubject === "All" or "all-subjects", allow all subjects ("All").
 */
export async function getTeacherSubject(authUser: { id: string; specialization?: string; assignedSubject?: string }): Promise<TeacherSubject> {
  try {
    const user = await User.findById(authUser.id).select('assignedSubject specialization').lean();
    const assigned = (user as any)?.assignedSubject || authUser.assignedSubject;
    const spec = (user as any)?.specialization || authUser.specialization;

    // Strict first priority to assignedSubject
    if (assigned === 'Math') return 'Math';
    if (assigned === 'Science') return 'Science';
    if (assigned === 'Filipino') return 'Filipino';
    if (assigned === 'English') return 'English';
    if (assigned === 'Reading') return 'Reading';
    if (assigned === 'All') return 'All';

    // Fallback when assignedSubject is empty or undefined
    if (spec === 'reading') return 'Reading';
    if (spec === 'english') return 'English';
    if (spec === 'filipino') return 'Filipino';
    if (spec === 'all-subjects') return 'All';

    return 'All';
  } catch {
    const fallbackAssigned = (authUser as any)?.assignedSubject;
    if (fallbackAssigned === 'Math') return 'Math';
    if (fallbackAssigned === 'Science') return 'Science';
    if (fallbackAssigned === 'Filipino') return 'Filipino';
    if (fallbackAssigned === 'English') return 'English';
    if (fallbackAssigned === 'Reading') return 'Reading';
    if (fallbackAssigned === 'All') return 'All';

    if (authUser.specialization === 'reading') return 'Reading';
    return 'All';
  }
}

/**
 * Returns a MongoDB query filter for models that have a `subject` field (Recommendation, Assessment, AnswerKey).
 */
export function getSubjectFilter(teacherSubject: TeacherSubject, requestedSubject?: string | null): Record<string, any> {
  if (teacherSubject === 'Filipino') {
    return { subject: { $in: ['Filipino', 'Reading - Filipino'] } };
  }
  if (teacherSubject === 'English') {
    return { subject: { $in: ['English', 'Reading', 'Reading - English'] } };
  }
  if (teacherSubject === 'Reading') {
    if (requestedSubject === 'Filipino') {
      return { subject: { $in: ['Filipino', 'Reading - Filipino'] } };
    }
    if (requestedSubject === 'English') {
      return { subject: { $in: ['English', 'Reading', 'Reading - English'] } };
    }
    return { subject: { $in: ['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'] } };
  }
  if (teacherSubject !== 'All') {
    return { subject: teacherSubject };
  }
  if (requestedSubject) {
    if (requestedSubject === 'Filipino') {
      return { subject: { $in: ['Filipino', 'Reading - Filipino'] } };
    }
    if (requestedSubject === 'English') {
      return { subject: { $in: ['English', 'Reading', 'Reading - English'] } };
    }
    if (['Reading', 'Math', 'Science'].includes(requestedSubject)) {
      return { subject: requestedSubject };
    }
  }
  return {};
}

/**
 * Returns a MongoDB query filter for Intervention models based on category and weakness matching.
 */
export function getInterventionSubjectFilter(teacherSubject: TeacherSubject, requestedSubject?: string | null): Record<string, any> {
  const target = teacherSubject !== 'All' ? teacherSubject : requestedSubject;
  if (!target || target === 'All') return {};

  if (target === 'Reading') {
    return {
      $or: [
        { category: { $regex: /reading|english|filipino|literacy/i } },
        { weakness: { $regex: /reading|comprehension|literacy/i } },
        { title: { $regex: /reading|english|filipino|phonics|passage|comprehension/i } },
      ],
    };
  }
  if (target === 'Math') {
    return {
      $or: [
        { category: { $regex: /math|numeracy/i } },
        { weakness: { $regex: /math|numeracy/i } },
        { title: { $regex: /math|numeracy|multiplication|addition|subtraction|division|fraction/i } },
      ],
    };
  }
  if (target === 'Science') {
    return {
      $or: [
        { category: { $regex: /science/i } },
        { weakness: { $regex: /science/i } },
        { title: { $regex: /science|ecosystem|matter|energy|force|motion|living/i } },
      ],
    };
  }
  return {};
}
