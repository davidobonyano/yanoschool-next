import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/authz';

function normalizeTermName(name: string): string {
  const n = (name || '').trim().toLowerCase();
  if (n === 'first term' || n === '1st term') return '1st Term';
  if (n === 'second term' || n === '2nd term') return '2nd Term';
  if (n === 'third term' || n === '3rd term') return '3rd Term';
  return name;
}

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.error as Response;

    const { searchParams } = new URL(request.url);
    const sessionName = searchParams.get('session');
    const termNameRaw = searchParams.get('term');
    const termName = termNameRaw ? normalizeTermName(termNameRaw) : null;

    // Resolve session/term IDs if provided
    let sessionId: string | null = null;
    let termId: string | null = null;
    if (sessionName) {
      const { data: srow, error: serr } = await supabase
        .from('academic_sessions')
        .select('id')
        .eq('name', sessionName)
        .maybeSingle();
      if (serr) return NextResponse.json({ error: serr.message }, { status: 500 });
      sessionId = srow?.id ?? null;
      if (!sessionId) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (termName && sessionId) {
      const { data: trowPreferred, error: terr } = await supabase
        .from('academic_terms')
        .select('id')
        .eq('session_id', sessionId)
        .eq('name', termName)
        .maybeSingle();
      if (terr) return NextResponse.json({ error: terr.message }, { status: 500 });
      let trow = trowPreferred;
      if (!trow?.id) {
        const { data: t2, error: t2err } = await supabase
          .from('academic_terms')
          .select('id')
          .eq('session_id', sessionId)
          .ilike('name', `%${termNameRaw}%`)
          .maybeSingle();
        if (t2err) return NextResponse.json({ error: t2err.message }, { status: 500 });
        trow = t2 || null;
      }
      termId = trow?.id ?? null;
      if (!termId) return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }

    let query = supabase
      .from('payment_records')
      .select('id, student_id, amount, purpose, paid_on, session_id, term_id')
      .order('paid_on', { ascending: false });

    if (sessionId) query = query.eq('session_id', sessionId);
    if (termId) query = query.eq('term_id', termId);

    type PaymentCore = { id: string; student_id: string; amount: number; purpose: string; paid_on: string; session_id: string | null; term_id: string | null };
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const studentIds = Array.from(new Set(((data as PaymentCore[] | null) || []).map((p) => p.student_id)));
    type StudentLite = { id: string; student_id: string; full_name: string };
    let studentsMap: Record<string, StudentLite> = {};
    if (studentIds.length > 0) {
      const { data: students, error: studentsErr } = await supabase
        .from('school_students')
        .select('id, student_id, full_name')
        .in('id', studentIds);
      if (studentsErr) return NextResponse.json({ error: studentsErr.message }, { status: 500 });
      studentsMap = ((students as StudentLite[] | null) || []).reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, StudentLite>);
    }

    // Map session/term IDs to names so rows always have readable values
    const sessionIds = Array.from(new Set(((data as PaymentCore[] | null) || []).map((p) => p.session_id).filter(Boolean))) as string[];
    const termIds = Array.from(new Set(((data as PaymentCore[] | null) || []).map((p) => p.term_id).filter(Boolean))) as string[];

    let sessionsMap: Record<string, string> = {};
    if (sessionIds.length > 0) {
      type SessionRow = { id: string; name: string };
      const { data: sessions, error: sessionsErr } = await supabase
        .from('academic_sessions')
        .select('id, name')
        .in('id', sessionIds);
      if (sessionsErr) return NextResponse.json({ error: sessionsErr.message }, { status: 500 });
      sessionsMap = ((sessions as SessionRow[] | null) || []).reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {} as Record<string, string>);
    }

    let termsMap: Record<string, string> = {};
    if (termIds.length > 0) {
      type TermRow = { id: string; name: string };
      const { data: terms, error: termsErr } = await supabase
        .from('academic_terms')
        .select('id, name')
        .in('id', termIds);
      if (termsErr) return NextResponse.json({ error: termsErr.message }, { status: 500 });
      termsMap = ((terms as TermRow[] | null) || []).reduce((acc, t) => { acc[t.id] = t.name; return acc; }, {} as Record<string, string>);
    }

    const payments = ((data as PaymentCore[] | null) || []).map((p) => ({
      id: p.id,
      student_name: studentsMap[p.student_id]?.full_name || 'Unknown',
      student_id: studentsMap[p.student_id]?.student_id || '',
      amount: Number(p.amount || 0),
      payment_method: 'N/A',
      description: p.purpose,
      transaction_date: p.paid_on,
      session: sessionName || (p.session_id ? sessionsMap[p.session_id] : '') || '',
      term: termNameRaw || (p.term_id ? termsMap[p.term_id] : '') || '',
    }));

    return NextResponse.json({ payments });
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


