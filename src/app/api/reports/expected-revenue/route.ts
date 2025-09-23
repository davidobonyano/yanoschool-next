import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/authz';
import { normalizeTermName } from '@/lib/term-utils';

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.error as Response;

    const { searchParams } = new URL(request.url);
    const termName = searchParams.get('term');
    const sessionName = searchParams.get('session');
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

    // Try to resolve term by multiple common variants
    const preferred = normalizeTermName(termName);
    const { data: preferredTerm, error: termErr } = await supabase
      .from('academic_terms')
      .select('id, name')
      .eq('session_id', sessionRow.id)
      .eq('name', preferred)
      .maybeSingle();
    if (termErr) return NextResponse.json({ error: termErr.message }, { status: 500 });

    let termRow = preferredTerm;
    if (!termRow?.id) {
      // Fallback: try ilike on original provided name
      const { data: t2, error: t2err } = await supabase
        .from('academic_terms')
        .select('id, name')
        .eq('session_id', sessionRow.id)
        .ilike('name', `%${termName}%`)
        .maybeSingle();
      if (t2err) return NextResponse.json({ error: t2err.message }, { status: 500 });
      termRow = t2 || null;
    }

    if (!termRow?.id) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    // Expected = sum student_charges; if empty, fall back to summing fee_structures per active student
    type ChargeRow = { student_id: string; amount: number };
    const { data: charges, error: chargesErr } = await supabase
      .from('student_charges')
      .select('student_id, amount')
      .eq('session_id', sessionRow.id)
      .eq('term_id', termRow.id);
    if (chargesErr) return NextResponse.json({ error: chargesErr.message }, { status: 500 });

    let expectedRevenue = ((charges as ChargeRow[] | null) || []).reduce((sum: number, c) => sum + Number(c.amount || 0), 0);

    if (!expectedRevenue) {
      // Fallback: compute expected by matching fee_structures to each active student (by class_level/stream)
      type StudentRow = { id: string; class_level: string | null; stream: string | null };
      const { data: students, error: stErr } = await supabase
        .from('school_students')
        .select('id, class_level, stream')
        .eq('is_active', true);
      if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

      type FeeRow = { class_level: string | null; stream: string | null; amount: number };
      const { data: fees, error: feeErr } = await supabase
        .from('fee_structures')
        .select('class_level, stream, amount')
        .eq('session_id', sessionRow.id)
        .eq('term_id', termRow.id)
        .eq('is_active', true);
      if (feeErr) return NextResponse.json({ error: feeErr.message }, { status: 500 });

      const norm = (v: string | null | undefined) => (v ?? '').toString().trim().toLowerCase();
      let sum = 0;
      for (const s of ((students as StudentRow[] | null) || [])) {
        const studentFees = ((fees as FeeRow[] | null) || []).filter(f => {
          const matchesClass = norm(f.class_level) === norm(s.class_level);
          const matchesStream = f.stream == null || f.stream === '' || norm(f.stream) === norm(s.stream);
          return matchesClass && matchesStream;
        });
        sum += studentFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
      }
      expectedRevenue = sum;
    }

    type PaymentRow = { student_id: string; amount: number };
    const { data: payments, error: payErr } = await supabase
      .from('payment_records')
      .select('student_id, amount')
      .eq('session_id', sessionRow.id)
      .eq('term_id', termRow.id);
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

    const actualRevenue = ((payments as PaymentRow[] | null) || []).reduce((sum: number, p) => sum + Number(p.amount || 0), 0);
    const outstanding = Math.max(0, expectedRevenue - actualRevenue);
    const totalStudents = new Set(((charges as ChargeRow[] | null) || []).map((c) => c.student_id)).size;
    const collectionRate = expectedRevenue > 0 ? (actualRevenue / expectedRevenue) * 100 : 0;

    return NextResponse.json({
      expectedRevenue,
      actualRevenue,
      outstanding,
      collectionRate,
      totalStudents
    });
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


