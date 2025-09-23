import { NextRequest, NextResponse } from 'next/server';
import { supabaseService as supabase } from '@/lib/supabase-server';

function termNamePatterns(term: 'First' | 'Second' | 'Third'): [string, string] {
	switch (term) {
		case 'First':
			return ['1st%', 'First%'];
		case 'Second':
			return ['2nd%', 'Second%'];
		case 'Third':
			return ['3rd%', 'Third%'];
	}
}

function normalizeTermName(term: string): 'First' | 'Second' | 'Third' {
	const t = (term || '').toLowerCase().trim();
	if (t.includes('first') || t.includes('1st') || t.startsWith('1')) return 'First';
	if (t.includes('second') || t.includes('2nd') || t.startsWith('2')) return 'Second';
	if (t.includes('third') || t.includes('3rd') || t.startsWith('3')) return 'Third';
	return 'First';
}

// Align with student transcript/summary GPA mapping
function computeGradePoint(grade: string | null | undefined): number {
    const g = (grade || '').toUpperCase();
    if (g === 'A1' || g.startsWith('A')) return 5.0;
    if (g === 'B2') return 4.5;
    if (g === 'B3') return 4.0;
    if (g === 'C4') return 3.5;
    if (g === 'C5') return 3.0;
    if (g === 'C6') return 2.5;
    if (g === 'D7') return 2.0;
    if (g === 'E8') return 1.0;
    return 0.0;
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const classLevel = searchParams.get('class_level');
		const stream = searchParams.get('stream');
        const term = searchParams.get('term');
		const session = searchParams.get('session');

		if (!classLevel || !term || !session) {
			return NextResponse.json({ error: 'class_level, term, session are required' }, { status: 400 });
		}

		// Resolve session and term ids
		const { data: sessionRow, error: sErr } = await supabase
			.from('academic_sessions')
			.select('id')
			.eq('name', session)
			.maybeSingle();
		if (sErr || !sessionRow) return NextResponse.json({ error: sErr?.message || 'Session not found' }, { status: 400 });

        const allTerms = (term || '').toLowerCase().includes('all');
        let termRow: { id: string } | null = null;
        if (!allTerms) {
            const termNorm = normalizeTermName(term);
            const [p1, p2] = termNamePatterns(termNorm);
            const { data, error: tErr } = await supabase
                .from('academic_terms')
                .select('id')
                .eq('session_id', sessionRow.id)
                .or(`name.ilike.${p1},name.ilike.${p2}`)
                .maybeSingle();
            if (tErr || !data) return NextResponse.json({ error: tErr?.message || 'Term not found' }, { status: 400 });
            termRow = data;
        }

		// Students in class/stream
		let studentsQuery = supabase
			.from('school_students')
			.select('student_id, full_name, class_level, stream')
			.eq('is_active', true)
			.eq('class_level', classLevel);
		if (stream && stream !== 'All' && stream !== 'null') {
			const s = String(stream).toLowerCase();
			let variants: string[] = [];
			if (s.startsWith('art')) variants = ['Art', 'Arts', 'art', 'arts', 'ART', 'ARTS'];
			else if (s.startsWith('science')) variants = ['Science', 'Sciences', 'science', 'sciences', 'SCIENCE', 'SCIENCES'];
			else if (s.startsWith('comm')) variants = ['Commercial', 'Commerce', 'commercial', 'commerce', 'COMMERCIAL', 'COMMERCE'];
			else variants = [stream];
			studentsQuery = studentsQuery.in('stream', variants);
		}
		const { data: students, error: stErr } = await studentsQuery;
		if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });
		const studentIds = (students || []).map(s => s.student_id);
		const idToName: Record<string, string> = {};
		(students || []).forEach(s => { idToName[s.student_id] = s.full_name; });
		if (studentIds.length === 0) return NextResponse.json({ courses: [], students: [] });

		// Courses for this class_level for this period
        let coursesQuery = supabase
            .from('courses')
            .select('id, name, class_level, term, term_id, session_id, stream')
            .eq('class_level', classLevel)
            .order('name', { ascending: true });
        // For SS classes, if a stream is selected, limit courses to that stream
        if (classLevel.startsWith('SS') && stream && stream !== 'All' && stream !== 'null') {
            const s = String(stream).toLowerCase();
            let variants: string[] = [];
            if (s.startsWith('art')) variants = ['Art', 'Arts', 'art', 'arts', 'ART', 'ARTS'];
            else if (s.startsWith('science')) variants = ['Science', 'Sciences', 'science', 'sciences', 'SCIENCE', 'SCIENCES'];
            else if (s.startsWith('comm')) variants = ['Commercial', 'Commerce', 'commercial', 'commerce', 'COMMERCIAL', 'COMMERCE'];
            else variants = [stream];
            coursesQuery = coursesQuery.in('stream', variants);
        } else if (!classLevel.startsWith('SS')) {
            // Non-SS classes should have stream null (or absent)
            coursesQuery = coursesQuery.is('stream', null);
        }
        const { data: courseRows, error: coursesError } = await coursesQuery;
		if (coursesError) return NextResponse.json({ error: coursesError.message }, { status: 500 });
        let courses = courseRows;
		// Fallback: if none matched due to missing term columns, fetch by class only
		if (!courses || courses.length === 0) {
			let fallbackQuery = supabase
				.from('courses')
				.select('id, name, class_level, stream')
				.eq('class_level', classLevel)
				.order('name', { ascending: true });
			if (classLevel.startsWith('SS') && stream && stream !== 'All' && stream !== 'null') {
				const s = String(stream).toLowerCase();
				let variants: string[] = [];
				if (s.startsWith('art')) variants = ['Art', 'Arts', 'art', 'arts', 'ART', 'ARTS'];
				else if (s.startsWith('science')) variants = ['Science', 'Sciences', 'science', 'sciences', 'SCIENCE', 'SCIENCES'];
				else if (s.startsWith('comm')) variants = ['Commercial', 'Commerce', 'commercial', 'commerce', 'COMMERCIAL', 'COMMERCE'];
				else variants = [stream];
				fallbackQuery = fallbackQuery.in('stream', variants);
			} else if (!classLevel.startsWith('SS')) {
				fallbackQuery = fallbackQuery.is('stream', null);
			}
			const fallback = await fallbackQuery;
			if (!fallback.error && fallback.data) {
				// Transform fallback data to match expected structure
                courses = fallback.data.map(course => ({
					id: course.id,
					name: course.name,
					class_level: course.class_level,
                    term: term,
                    term_id: termRow ? termRow.id : null,
					session_id: sessionRow.id,
                    stream: (course as any).stream ?? null
				}));
			}
		}

        // Dedupe by name (case-insensitive), prefer entries with matching term_id if a specific term is selected; otherwise allow any for the session
		type CourseRow = { id: string; name: string; term_id?: string | null } & Record<string, unknown>;
    const uniqueByName: Record<string, CourseRow> = {};
    for (const c of ((courses as CourseRow[] | null) || [])) {
			const key = String(c.name || '').trim().toLowerCase();
			if (!key) continue;
			const existing = uniqueByName[key];
			if (!existing) {
				uniqueByName[key] = c;
			} else {
        const existingPref = (!allTerms && termRow && (existing.term_id as string | null) === termRow.id) ? 1 : 0;
        const currentPref = (!allTerms && termRow && (c.term_id as string | null) === termRow.id) ? 1 : 0;
				if (currentPref > existingPref) uniqueByName[key] = c;
			}
		}
    const uniqueCourses = Object.values(uniqueByName);

		// Results for this period and students (for per-course rankings)
        let periodQuery = supabase
            .from('student_results')
            .select('student_id, course_id, total_score, grade')
            .eq('session_id', sessionRow.id)
            .in('student_id', studentIds);
        if (!allTerms && termRow) periodQuery = periodQuery.eq('term_id', termRow.id);
        const { data: periodResults, error: prErr } = await periodQuery;
		if (prErr) return NextResponse.json({ error: prErr.message }, { status: 500 });

		// All results for CGPA (across all sessions/terms)
		const { data: allResults, error: arErr } = await supabase
			.from('student_results')
			.select('student_id, total_score, grade')
			.in('student_id', studentIds);
		if (arErr) return NextResponse.json({ error: arErr.message }, { status: 500 });

		// Build per-course rankings
    type PeriodResult = { student_id: string; course_id: string; total_score: number; grade: string | null };
    const courseIdToRows: Record<string, { studentId: string; fullName: string; score: number }[]> = {};
    ((periodResults as PeriodResult[] | null) || []).forEach((r) => {
			const list = courseIdToRows[r.course_id] || [];
			list.push({ studentId: r.student_id, fullName: idToName[r.student_id] || r.student_id, score: Number(r.total_score || 0) });
			courseIdToRows[r.course_id] = list;
		});
		Object.keys(courseIdToRows).forEach(cid => {
			courseIdToRows[cid].sort((a, b) => b.score - a.score);
			let rank = 0; let last: number | null = null;
			courseIdToRows[cid] = courseIdToRows[cid].map(row => {
				if (last === null || row.score < last) { rank += 1; last = row.score; }
				return { ...row, rank };
			});
		});

		// Per-student GPA for period and CGPA overall (simple GPA: average grade points across subjects)
    const studentPeriodGpa: Record<string, number> = {};
		const studentCgpa: Record<string, number> = {};
		const periodGrades: Record<string, number[]> = {};
		const allGrades: Record<string, number[]> = {};

    ((periodResults as PeriodResult[] | null) || []).forEach((r) => {
			const gp = computeGradePoint(r.grade);
			if (!periodGrades[r.student_id]) periodGrades[r.student_id] = [];
			periodGrades[r.student_id].push(gp);
		});
		Object.keys(periodGrades).forEach(sid => {
			const arr = periodGrades[sid];
			studentPeriodGpa[sid] = arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
		});

    type AnyResult = { student_id: string; grade: string | null };
    ((allResults as AnyResult[] | null) || []).forEach((r) => {
			const gp = computeGradePoint(r.grade);
			if (!allGrades[r.student_id]) allGrades[r.student_id] = [];
			allGrades[r.student_id].push(gp);
		});
		Object.keys(allGrades).forEach(sid => {
			const arr = allGrades[sid];
			studentCgpa[sid] = arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
		});

		// Compose course summaries
		const uniqueCourseIds = new Set<string>((uniqueCourses || []).map((c: any) => c.id));
		const resultCourseIds = new Set<string>(Object.keys(courseIdToRows));
		const missingCourseIds: string[] = Array.from(resultCourseIds).filter(id => !uniqueCourseIds.has(id));
		let missingCourses: Array<{ id: string; name: string }> = [];
		if (missingCourseIds.length > 0) {
			const { data: extraCourses } = await supabase
				.from('courses')
				.select('id, name')
				.in('id', missingCourseIds);
			missingCourses = (extraCourses || []).filter((c: any) => !!c?.id && !!c?.name) as Array<{ id: string; name: string }>;
		}
		const allCoursesForSummary = [
			...uniqueCourses,
			...missingCourses.map(c => ({ id: c.id, name: c.name }))
		];

		// Dedupe by course name and pick the candidate that has actual results if available
		type SimpleCourse = { id: string; name: string };
		const nameToCandidates: Record<string, SimpleCourse[]> = {};
		(allCoursesForSummary as SimpleCourse[]).forEach((c) => {
			const key = String(c.name || '').trim().toLowerCase();
			if (!key) return;
			if (!nameToCandidates[key]) nameToCandidates[key] = [];
			nameToCandidates[key].push(c);
		});
		const dedupedCourses: SimpleCourse[] = Object.keys(nameToCandidates).map((key) => {
			const candidates = nameToCandidates[key];
			const withResults = candidates.find(c => (courseIdToRows[c.id] || []).length > 0);
			return withResults || candidates[0];
		});

		const courseSummaries = (dedupedCourses || []).map((c: SimpleCourse) => {
			// Start with actual result rows, then ensure all students are present with default 0
			const existingRows = (courseIdToRows[c.id] || []).map(r => ({ ...r }));
			const present = new Set<string>(existingRows.map(r => r.studentId));
			studentIds.forEach((sid) => {
				if (!present.has(sid)) {
					existingRows.push({ studentId: sid, fullName: idToName[sid] || sid, score: 0 });
				}
			});
			const hasAnyScore = existingRows.some(r => Number(r.score || 0) > 0);
			if (!hasAnyScore) {
				return {
					courseId: c.id,
					courseName: c.name,
					topStudent: null,
					rankings: [] as { studentId: string; fullName: string; score: number; rank?: number }[]
				};
			}
			// Sort and rank including zeros
			existingRows.sort((a, b) => b.score - a.score);
			let rank = 0; let last: number | null = null;
			const ranked = existingRows.map(row => {
				if (last === null || row.score < last) { rank += 1; last = row.score; }
				return { ...row, rank };
			});
			const top = ranked[0] || null;
			return {
				courseId: c.id,
				courseName: c.name,
				topStudent: top,
				rankings: ranked
			};
		});

		// Compose students list with GPA/CGPA
		const studentsList = (students || []).map(s => ({
			studentId: s.student_id,
			fullName: s.full_name,
			gpa: Number((studentPeriodGpa[s.student_id] || 0).toFixed(2)),
			cgpa: Number((studentCgpa[s.student_id] || 0).toFixed(2))
		}));

		// Overall best by aggregate this period
        const totalsMap = new Map<string, number>();
		((periodResults as { student_id: string; total_score: number }[] | null) || []).forEach((r) => {
			totalsMap.set(r.student_id, (totalsMap.get(r.student_id) || 0) + Number(r.total_score || 0));
		});
		const overall = studentsList.map(s => ({
			studentId: s.studentId,
			fullName: s.fullName,
			aggregate: totalsMap.get(s.studentId) || 0
		})).sort((a, b) => b.aggregate - a.aggregate).map((row, idx) => ({ ...row, rank: idx + 1 }));

		return NextResponse.json({
			courses: courseSummaries,
			students: studentsList,
			overall
		});
		} catch (err) {
			const e = err as Error;
			return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
	}
}
