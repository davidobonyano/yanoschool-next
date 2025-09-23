import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseService } from '@/lib/supabase-server';
import { readTeacherSession } from '@/lib/teacher-session';

function normalizeTermName(term: string | null | undefined): 'First' | 'Second' | 'Third' {
  const t = String(term || '').toLowerCase();
  if (t.includes('third') || t.includes('3rd') || t.startsWith('3')) return 'Third';
  if (t.includes('second') || t.includes('2nd') || t.startsWith('2')) return 'Second';
  return 'First';
}

function getTermAliases(termName: string | null | undefined): string[] {
  const norm = normalizeTermName(termName);
  if (norm === 'First') return ['First', '1st Term', 'First Term', '1st'];
  if (norm === 'Second') return ['Second', '2nd Term', 'Second Term', '2nd'];
  return ['Third', '3rd Term', 'Third Term', '3rd'];
}

export async function GET() {
  try {
    // Get teacher session
    const session = await readTeacherSession();
    if (!session) {
      return NextResponse.json({ error: 'Teacher not authenticated' }, { status: 401 });
    }

    // Get current academic context
    const { data: currentContext, error: contextErr } = await supabase
      .rpc('get_current_academic_context');
    
    let currentTermId: string | null = null;
    let currentSessionId: string | null = null;
    let currentTermName: string | null = null;
    let currentSessionName: string | null = null;
    
    if (contextErr) {
      console.warn('Could not get current academic context:', contextErr.message);
    } else if (currentContext && currentContext.length > 0) {
      currentTermId = currentContext[0].term_id;
      currentSessionId = currentContext[0].session_id;
      currentTermName = currentContext[0].term_name || null;
      currentSessionName = currentContext[0].session_name || null;
    }

    // Fallback: resolve active session/term if RPC did not return ids
    if (!currentSessionId || !currentTermId) {
      try {
        // Active session
        const { data: activeSession } = await supabase
          .from('academic_sessions')
          .select('id, name')
          .eq('is_active', true)
          .maybeSingle();
        if (activeSession) {
          currentSessionId = activeSession.id;
          currentSessionName = activeSession.name;
        }
        // Active term within that session
        if (currentSessionId) {
          const { data: activeTerm } = await supabase
            .from('academic_terms')
            .select('id, name')
            .eq('session_id', currentSessionId)
            .eq('is_active', true)
            .maybeSingle();
          if (activeTerm) {
            currentTermId = activeTerm.id;
            currentTermName = activeTerm.name;
          }
        }
      } catch (e) {
        console.warn('Fallback active term/session resolution failed:', (e as any)?.message || e);
      }
    }

    // 1. Get assigned courses for this teacher (from timetable subjects)
    // Try ID-based filtering first; if that yields no rows and we have names, retry with name-based filters.
    let { data: timetableCourses } = await supabase
      .from('timetables')
      .select('subject, class, session, term')
      .eq('teacher_name', session.name || '')
      .eq('session_id', currentSessionId)
      .eq('term_id', currentTermId);

    if ((!timetableCourses || timetableCourses.length === 0) && (currentSessionName || currentTermName)) {
      const termAliases = getTermAliases(currentTermName);
      const retry = await supabase
        .from('timetables')
        .select('subject, class, session, term')
        .eq('teacher_name', session.name || '')
        .eq('session', currentSessionName || '')
        .in('term', termAliases);
      timetableCourses = retry.data as any[] | null;
    }

    type TimetableCourse = { subject?: string | null; class?: string | null };
    const assignedCourses: TimetableCourse[] = (timetableCourses as TimetableCourse[] | null) || [];
    const uniqueCourses = [...new Set(assignedCourses.map(c => c.subject).filter((s): s is string => Boolean(s)))]

    // Derive base class levels taught by this teacher (e.g., "SS1 Science" -> "SS1")
    const classLevelsTaught = new Set<string>();
    (assignedCourses || []).forEach((c: TimetableCourse) => {
      const cls = (c.class || '').toString().trim();
      if (!cls) return;
      const base = cls.split(' ')[0];
      if (base) classLevelsTaught.add(base);
    });

    // 2. Get students with results count (distinct students for the current term/session)
    let studentsWithResultsCount = 0;
    if (currentSessionId && currentTermId) {
      const { data: resultRows } = await supabase
        .from('student_results')
        .select('student_id')
        .eq('session_id', currentSessionId)
        .eq('term_id', currentTermId);
      if (Array.isArray(resultRows) && resultRows.length > 0) {
        const distinctStudentIds = new Set<string>();
        resultRows.forEach((r: { student_id?: string | null }) => { if (r?.student_id) distinctStudentIds.add(r.student_id); });
        studentsWithResultsCount = distinctStudentIds.size;
      } else if (currentSessionName && currentTermName) {
        // Fallback to name-based when id-based yields no rows, using term aliases (1st/2nd/3rd)
        const termAliases = getTermAliases(currentTermName);
        const { data: nameRows } = await supabase
          .from('student_results')
          .select('student_id')
          .eq('session', currentSessionName)
          .in('term', termAliases);
        if (Array.isArray(nameRows)) {
          const distinctStudentIds = new Set<string>();
          nameRows.forEach((r: { student_id?: string | null }) => {
            if (!r?.student_id) return;
            distinctStudentIds.add(r.student_id);
          });
          studentsWithResultsCount = distinctStudentIds.size;
        }
      }
    } else if (currentSessionName && currentTermName) {
      const termAliases = getTermAliases(currentTermName);
      const { data: resultRows } = await supabase
        .from('student_results')
        .select('student_id')
        .eq('session', currentSessionName)
        .in('term', termAliases);
      if (Array.isArray(resultRows)) {
        const distinctStudentIds = new Set<string>();
        resultRows.forEach((r: { student_id?: string | null }) => {
          if (!r?.student_id) return;
          distinctStudentIds.add(r.student_id);
        });
        studentsWithResultsCount = distinctStudentIds.size;
      }
    }

    // 3. Get upcoming exams count from exam_sessions based on teacher's class levels (service client to avoid RLS)
    let upcomingExamsCount = 0;
    try {
      const nowIso = new Date().toISOString();
      const levels = Array.from(classLevelsTaught);
      let query = supabaseService
        .from('exam_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('ends_at', nowIso);
      if (levels.length === 1) {
        query = query.eq('class_level', levels[0]);
      } else if (levels.length > 1) {
        query = query.in('class_level', levels);
      }
      const { count, error } = await query;
      // Fallback: if no levels detected or zero count, count all active upcoming sessions
      if ((!levels.length || (count || 0) === 0) && !error) {
        const fallback = await supabaseService
          .from('exam_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .gte('ends_at', nowIso);
        upcomingExamsCount = fallback.count || 0;
      } else if (!error) {
        upcomingExamsCount = count || 0;
      }
    } catch (e) {
      console.warn('Upcoming exams count failed:', (e as any)?.message || e);
    }

    // 4. Get teacher's classes from timetable for today's schedule
    let { data: teacherClasses } = await supabase
      .from('timetables')
      .select('class, subject, day, period, session, term')
      .eq('teacher_name', session.name || '')
      .eq('session_id', currentSessionId)
      .eq('term_id', currentTermId);

    if ((!teacherClasses || teacherClasses.length === 0) && (currentSessionName || currentTermName)) {
      const termAliases = getTermAliases(currentTermName);
      const retry = await supabase
        .from('timetables')
        .select('class, subject, day, period, session, term')
        .eq('teacher_name', session.name || '')
        .eq('session', currentSessionName || '')
        .in('term', termAliases);
      teacherClasses = retry.data as any[] | null;
    }

    // Get today's schedule
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    type TeacherClass = { day?: string | null };
    const todaySchedule = ((teacherClasses as TeacherClass[] | null) || []).filter(
      (item: TeacherClass) => (item.day || '').toLowerCase() === dayName.toLowerCase()
    );

    // 5. Get announcements for teachers
    const { data: announcements } = await supabase
      .from('announcements')
      .select('*')
      .or('audience.eq.teachers,audience.eq.all,audience_role.eq.teacher')
      .order('created_at', { ascending: false })
      .limit(5);

    // 6. Approvals summary (service client) - term/session scoped when available
    let approvedStudents = 0;
    let approvedCourses = 0;
    try {
      let approvalsQuery = supabaseService
        .from('student_course_registrations')
        .select('student_id, course_id, session_id, term_id, session, term, status')
        .eq('status', 'approved');
      if (currentSessionId) approvalsQuery = approvalsQuery.eq('session_id', currentSessionId);
      if (currentTermId) approvalsQuery = approvalsQuery.eq('term_id', currentTermId);
      let { data: approvedRowsRaw } = await approvalsQuery as unknown as { data: any[] | null };

      // Apply name-based filter when ids missing or columns are strings
      let approvedRows: any[] = Array.isArray(approvedRowsRaw) ? approvedRowsRaw : [];
      if (((!currentSessionId && currentSessionName) || (!currentTermId && currentTermName))) {
        const targetTerm = normalizeTermName(currentTermName);
        approvedRows = approvedRows.filter((r: any) => {
          const sessionOk = currentSessionId ? true : (r.session === currentSessionName);
          const termOk = currentTermId ? true : (normalizeTermName(r.term) === targetTerm);
          return sessionOk && termOk;
        });
      } else if (approvedRows.length === 0 && currentSessionName && currentTermName) {
        // Fallback: ids exist but rows likely store names
        const termAliases = getTermAliases(currentTermName);
        const { data: byName } = await supabaseService
          .from('student_course_registrations')
          .select('student_id, course_id, session, term, status')
          .eq('status', 'approved')
          .eq('session', currentSessionName)
          .in('term', termAliases);
        approvedRows = Array.isArray(byName) ? (byName as any[]) : [];
      }

      const studentSet = new Set<string>();
      let courseCount = 0;
      approvedRows.forEach((r: { student_id?: string | null; course_id?: string | null }) => {
        if (r.student_id) studentSet.add(r.student_id);
        if (r.course_id) courseCount += 1;
      });
      approvedStudents = studentSet.size;
      approvedCourses = courseCount;
    } catch (e) {
      console.warn('Approvals summary failed:', (e as any)?.message || e);
    }

    return NextResponse.json({
      assignedCourses: uniqueCourses.length,
      studentsWithResults: studentsWithResultsCount,
      upcomingExams: upcomingExamsCount,
      todaySchedule: todaySchedule,
      announcements: announcements || [],
      approvedStudents,
      approvedCourses
    });

  } catch (error) {
    console.error('Error fetching teacher dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}




