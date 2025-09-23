import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/authz';
import { normalizeTermName as normalizeTerm } from '@/lib/term-utils';

const normalizeTermName = normalizeTerm;

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

    // Resolve session and term IDs from names
    const { data: sessionRow, error: sessErr } = await supabase
      .from('academic_sessions')
      .select('id, name')
      .eq('name', sessionName)
      .maybeSingle();
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });
    if (!sessionRow?.id) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const preferred = normalizeTermName(termName);
    const { data: preferredTerm, error: termErr } = await supabase
      .from('academic_terms')
      .select('id, name, session_id')
      .eq('session_id', sessionRow.id)
      .eq('name', preferred)
      .maybeSingle();
    if (termErr) return NextResponse.json({ error: termErr.message }, { status: 500 });

    let termRow = preferredTerm;
    if (!termRow?.id) {
      const { data: t2, error: t2err } = await supabase
        .from('academic_terms')
        .select('id, name, session_id')
        .eq('session_id', sessionRow.id)
        .ilike('name', `%${termName}%`)
        .maybeSingle();
      if (t2err) return NextResponse.json({ error: t2err.message }, { status: 500 });
      termRow = t2 || null;
    }

    if (!termRow?.id) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    // Expected from student_charges; collected from payment_records
    type ChargeRow = { amount: number };
    const { data: charges, error: chargesErr } = await supabase
      .from('student_charges')
      .select('amount')
      .eq('session_id', sessionRow.id)
      .eq('term_id', termRow.id);
    if (chargesErr) return NextResponse.json({ error: chargesErr.message }, { status: 500 });

    const expected = ((charges as ChargeRow[] | null) || []).reduce((sum: number, c) => sum + Number(c.amount || 0), 0);

    type PaymentRow = { amount: number };
    const { data: payments, error: payErr } = await supabase
      .from('payment_records')
      .select('amount')
      .eq('session_id', sessionRow.id)
      .eq('term_id', termRow.id);
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

    const collected = ((payments as PaymentRow[] | null) || []).reduce((sum: number, p) => sum + Number(p.amount || 0), 0);
    const outstanding = Math.max(0, expected - collected);

    return NextResponse.json({
      summary: {
        expected,
        collected,
        outstanding,
        term: termName,
        session: sessionName
      }
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


