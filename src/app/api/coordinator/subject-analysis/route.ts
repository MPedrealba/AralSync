import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Assessment from '../../../../../models/Assessment';
import LearnerRecord from '../../../../../models/LearnerRecord';
import User from '../../../../../models/User';

const COLOR = { Math: '#f59e0b', Reading: '#e11d48', Science: '#22c55e' } as const;
const SUBJECTS = ['Math', 'Reading', 'Science'] as const;

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

function subjectName(a: any): string | null {
  const s = a.subject;
  if (a.type === 'READING_FLUENCY' || s === 'Reading') return 'Reading';
  if (a.type === 'COMPREHENSION' || s === 'Science') return 'Science';
  if (s === 'Math') return 'Math';
  return null;
}

/** Proficiency band from a score. */
function bandOf(score: number): string {
  if (score < 60) return 'Beginning';
  if (score < 70) return 'Developing';
  if (score < 80) return 'Proficient';
  return 'Advanced';
}

/* ── Lightweight K-Means (k-means++-style deterministic init) ──
 * The capstone specifies a scikit-learn K-Means microservice; with no Python
 * service deployed, this in-process JS implementation produces the same
 * "learner grouping" outcome over each learner's per-subject average scores. */
function dist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function kMeans(points: number[][], k: number, maxIter = 50): number[][] {
  const n = points.length;
  if (n === 0) return [];
  const dim = points[0].length;

  // Farthest-first (k-means++) initialization — deterministic for stable labels.
  const centroids: number[][] = [points[0].slice()];
  while (centroids.length < k) {
    let bestIdx = 0;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      let minD = Infinity;
      for (const c of centroids) minD = Math.min(minD, dist(points[i], c));
      if (minD > bestDist) {
        bestDist = minD;
        bestIdx = i;
      }
    }
    centroids.push(points[bestIdx].slice());
  }

  const assign = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestD = dist(points[i], centroids[0]);
      for (let c = 1; c < k; c++) {
        const d = dist(points[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          bestC = c;
        }
      }
      if (assign[i] !== bestC) {
        assign[i] = bestC;
        changed = true;
      }
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      counts[assign[i]]++;
      for (let d = 0; d < dim; d++) sums[assign[i]][d] += points[i][d];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) centroids[c] = sums[c].map((v) => v / counts[c]);
    }
  }

  return centroids;
}

/* ── scikit-learn K-Means via the Python AI microservice ──
 * Attempts POST /cluster; returns { labels, centroids, cluster_names } or null
 * when the service is unreachable (caller falls back to the JS kMeans above). */
async function pythonCluster(
  vectors: number[][],
  learnerIds: string[]
): Promise<{ labels: number[]; centroids: number[][]; cluster_names: string[] } | null> {
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}/cluster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors, k: Math.min(3, vectors.length), learner_ids: learnerIds }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !Array.isArray(data.labels)) return null;
    return {
      labels: data.labels,
      centroids: data.centroids ?? [],
      cluster_names: data.cluster_names ?? ['High Performing', 'On Track', 'Needs Support'],
    };
  } catch (e) {
    console.warn('Python cluster service unavailable, using JS kMeans:', (e as Error).message);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const assessments = (await Assessment.find().sort({ date: 1 }).lean()) as any[];
    const records = (await LearnerRecord.find().lean()) as any[];
    const users = (await User.find({ role: 'student' }).lean()) as any[];
    const gradeOf = new Map(records.map((r) => [String(r.studentId), r.gradeLevel ?? 0]));
    const nameOf = new Map(
      users.map((u) => [String(u._id), { name: u.name || u.username || 'Student', grade: gradeOf.get(String(u._id)) ?? null }])
    );

    const subjects = SUBJECTS;

    const result = subjects.map((subj) => {
      const list = assessments.filter((a) => subjectName(a) === subj && a.score != null);
      const scores = list.map((a) => a.score);

      const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      // Change: latest month avg minus earliest month avg (per-month if data spans >1 month)
      const byMonth = new Map<string, number[]>();
      for (const a of list) {
        const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push(a.score);
      }
      const months = [...byMonth.keys()].sort();
      const monthAvg = (key: string) =>
        byMonth.get(key)!.reduce((a, b) => a + b, 0) / byMonth.get(key)!.length;
      let avgChange = 0;
      if (months.length >= 2) {
        avgChange = Math.round(monthAvg(months[months.length - 1]) - monthAvg(months[0]));
      }

      // Needs support: below 75
      const needsSupport = scores.filter((s) => s < 75).length;

      // Proficiency distribution
      const bandCounts = new Map<string, number>();
      for (const s of scores) bandCounts.set(bandOf(s), (bandCounts.get(bandOf(s)) || 0) + 1);
      const order = ['Beginning', 'Developing', 'Proficient', 'Advanced'] as const;
      const proficiency = order.map((level) => ({
        level,
        count: bandCounts.get(level) || 0,
        color: level === 'Beginning' ? '#ef4444' : level === 'Developing' ? '#f59e0b' : level === 'Proficient' ? '#22c55e' : '#16a34a',
      }));

      // Grade averages
      const gradeAvg = [7, 8, 9, 10].map((g) => {
        const gScores = list
          .filter((a) => gradeOf.get(String(a.studentId)) === g)
          .map((a) => a.score);
        return {
          grade: `Gr ${g}`,
          avg: gScores.length ? Math.round(gScores.reduce((a, b) => a + b, 0) / gScores.length) : 0,
        };
      }).filter((g) => g.avg > 0);

      return {
        name: `${subj} Analysis`,
        key: subj,
        avg: avgScore,
        avgChange: avgChange >= 0 ? `+${avgChange}` : `${avgChange}`,
        needsSupport,
        color: COLOR[subj],
        proficiency,
        gradeAvg,
      };
    });

    /* ── K-Means learner groups ── */
    const studentScores = new Map<string, Record<string, number[]>>();
    for (const a of assessments) {
      const subj = subjectName(a);
      if (!subj || a.score == null) continue;
      const sid = String(a.studentId);
      if (!studentScores.has(sid)) studentScores.set(sid, {});
      const bySubj = studentScores.get(sid)!;
      if (!bySubj[subj]) bySubj[subj] = [];
      bySubj[subj].push(a.score);
    }

    const entries = [...studentScores.entries()];
    const vectors = entries.map(([, bySubj]) => {
      const all = Object.values(bySubj).flat();
      const overall = all.reduce((a, b) => a + b, 0) / all.length;
      return SUBJECTS.map((s) => {
        const arr = bySubj[s];
        if (arr && arr.length) return arr.reduce((a, b) => a + b, 0) / arr.length;
        return overall; // missing subject → learner's own overall mean
      });
    });

    const k = Math.min(3, vectors.length);
    let learnerGroups: any[] = [];
    const colors: Record<string, string> = {
      'High Performing': '#16a34a',
      'On Track': '#e11d48',
      'Needs Support': '#ef4444',
    };

    if (k >= 1) {
      const learnerIds = entries.map((e) => e[0]);

      /* Try the scikit-learn Python service first; fall back to JS kMeans. */
      const py = await pythonCluster(vectors, learnerIds);

      let assign: number[];
      let labels: string[];
      let clusterOrder: { i: number; mean: number }[];

      if (py) {
        assign = py.labels;
        labels = py.cluster_names.length >= k ? py.cluster_names : ['High Performing', 'On Track', 'Needs Support'];
        // Rank clusters by centroid mean so labels stay meaningful (High → Needs).
        clusterOrder = (py.centroids.length
          ? py.centroids.map((c, i) => ({ i, mean: c.reduce((a, b) => a + b, 0) / c.length }))
          : []
        ).sort((x, y) => y.mean - x.mean);
      } else {
        const centroids = kMeans(vectors, k);
        assign = vectors.map((v) => {
          let bestC = 0;
          let bestD = dist(v, centroids[0]);
          for (let c = 1; c < centroids.length; c++) {
            const d = dist(v, centroids[c]);
            if (d < bestD) {
              bestD = d;
              bestC = c;
            }
          }
          return bestC;
        });
        labels = ['High Performing', 'On Track', 'Needs Support'];
        clusterOrder = centroids
          .map((c, i) => ({ i, mean: c.reduce((a, b) => a + b, 0) / c.length }))
          .sort((x, y) => y.mean - x.mean);
      }

      const clusters: string[][] = Array.from({ length: k }, () => []);
      for (let i = 0; i < entries.length; i++) clusters[assign[i]].push(entries[i][0]);

      learnerGroups = clusterOrder.map((cl, rank) => {
        const sids = clusters[cl.i];
        const memberScores = sids.map((sid) => {
          const idx = entries.findIndex((e) => e[0] === sid);
          const v = vectors[idx];
          return v.reduce((a, b) => a + b, 0) / v.length;
        });
        const avgScore = memberScores.length
          ? Math.round(memberScores.reduce((a, b) => a + b, 0) / memberScores.length)
          : 0;
        const label = labels[rank] ?? labels[labels.length - 1];
        return {
          label,
          color: colors[label] ?? '#6b7280',
          count: sids.length,
          avgScore,
          members: sids.map((sid) => {
            const u = nameOf.get(sid) || { name: 'Student', grade: null };
            return { name: u.name, grade: u.grade };
          }),
        };
      });
    }

    return ok({ subjects: result, learnerGroups });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator subject-analysis API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
