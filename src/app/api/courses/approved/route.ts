import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const term = searchParams.get('term');
    const session = searchParams.get('session');

    if (!studentId || !term || !session) {
      return NextResponse.json({ error: 'student_id, term, session are required' }, { status: 400 });
    }

    // Fetch approved registrations joined with course details
    const { data, error } = await supabase
      .from('student_course_registrations')
      .select(`
        course_id,
        status,
        courses:course_id(id, name, code, class_level)
      `)
      .eq('status', 'approved')
      .eq('term', term)
      .eq('session', session)
      .in('student_id', (
        // Note: student_course_registrations.student_id references school_students.id (uuid),
        // so we map from the provided student_id (text) to the internal uuid.
        await supabase
          .from('school_students')
          .select('id')
          .eq('student_id', studentId)
      ).data?.map((r: { id: string }) => r.id) || []);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type Row = { course_id: string; courses?: { id?: string; name?: string; code?: string; class_level?: string } };
    const courses = (data as Row[] | null || []).map((r: Row) => ({
      id: r.courses?.id || r.course_id,
      name: r.courses?.name,
      code: r.courses?.code,
      class_level: r.courses?.class_level,
    }));

    return NextResponse.json({ courses });
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}




