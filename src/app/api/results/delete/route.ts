import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type DeleteBody = {
  studentId: string; // school_students.student_id (e.g., YAN001)
  courseId?: string; // optional UUID
  courseCode?: string; // optional course code like MTH101
  session: string; // e.g., '2025/2026'
  term: string; // e.g., '1st Term' | 'Second' | 'Third Term'
};

function normalizeTermName(term: string): 'First' | 'Second' | 'Third' {
  const t = (term || '').toLowerCase();
  if (t.includes('third') || t.includes('3rd') || t.startsWith('3')) return 'Third';
  if (t.includes('second') || t.includes('2nd') || t.startsWith('2')) return 'Second';
  return 'First';
}

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeleteBody;
    const { studentId, courseId: incomingCourseId, courseCode, session, term } = body || ({} as DeleteBody);

    if (!studentId || (!incomingCourseId && !courseCode) || !session || !term) {
      return NextResponse.json({ error: 'studentId, (courseId or courseCode), session, term are required' }, { status: 400 });
    }

    // Resolve session id
    const { data: sessionRow, error: sErr } = await supabase
      .from('academic_sessions')
      .select('id, name')
      .eq('name', session)
      .maybeSingle();
    if (sErr || !sessionRow) {
      return NextResponse.json({ error: sErr?.message || 'Session not found' }, { status: 400 });
    }

    // Resolve term id with alias patterns
    const norm = normalizeTermName(term);
    const [p1, p2] = termNamePatterns(norm);
    const { data: termRow, error: tErr } = await supabase
      .from('academic_terms')
      .select('id, name')
      .eq('session_id', sessionRow.id)
      .or(`name.ilike.${p1},name.ilike.${p2}`)
      .maybeSingle();
    if (tErr || !termRow) {
      return NextResponse.json({ error: tErr?.message || 'Term not found' }, { status: 400 });
    }

    // Resolve course id by code if needed
    let courseId = incomingCourseId || '';
    if (!courseId && courseCode) {
      const { data: courseRow, error: cErr } = await supabase
        .from('courses')
        .select('id, code')
        .ilike('code', courseCode)
        .maybeSingle();
      if (cErr || !courseRow) {
        return NextResponse.json({ error: cErr?.message || `Course not found for code ${courseCode}` }, { status: 400 });
      }
      courseId = courseRow.id as string;
    }

    // Delete the result row(s) for this student/course/session/term
    const { error: delErr } = await supabase
      .from('student_results')
      .delete()
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .eq('session_id', sessionRow.id)
      .eq('term_id', termRow.id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message || 'Failed to delete result' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}



