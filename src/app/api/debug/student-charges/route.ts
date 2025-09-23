import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/authz';

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.error as Response;

    const { searchParams } = new URL(request.url);
    const termName = searchParams.get('term');
    const sessionName = searchParams.get('session');
    const classLevel = searchParams.get('class_level');
    const stream = searchParams.get('stream');

    if (!termName || !sessionName) {
      return NextResponse.json({ error: 'term and session are required' }, { status: 400 });
    }

    // Resolve session/term IDs
    const { data: sessionRow, error: sessErr } = await supabase
      .from('academic_sessions')
      .select('id, name')
      .eq('name', sessionName)
      .maybeSingle();
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });
    if (!sessionRow?.id) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const { data: termRow, error: termErr } = await supabase
      .from('academic_terms')
      .select('id, name')
      .eq('session_id', sessionRow.id)
      .eq('name', termName)
      .maybeSingle();
    if (termErr) return NextResponse.json({ error: termErr.message }, { status: 500 });
    if (!termRow?.id) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    // Get student charges with student details
    let query = supabase
      .from('student_charges')
      .select(`
        id,
        student_id,
        purpose,
        description,
        amount,
        carried_over,
        created_at,
        school_students!inner(
          student_id,
          full_name,
          class_level,
          stream
        )
      `)
      .eq('session_id', sessionRow.id)
      .eq('term_id', termRow.id);

    if (classLevel) {
      query = query.eq('school_students.class_level', classLevel);
    }
    if (stream) {
      query = query.eq('school_students.stream', stream);
    }

    const { data: charges, error: chargesErr } = await query;
    if (chargesErr) return NextResponse.json({ error: chargesErr.message }, { status: 500 });

    // Calculate totals
    const totalAmount = ((charges as any[]) || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const uniqueStudents = new Set(((charges as any[]) || []).map(c => c.student_id)).size;

    return NextResponse.json({
      charges: charges || [],
      summary: {
        totalAmount,
        uniqueStudents,
        totalRecords: (charges || []).length
      }
    });
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}







