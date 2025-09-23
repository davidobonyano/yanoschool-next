import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { readAdminSession } from '@/lib/admin-session';

// Returns totals per class/term: expected (charges), collected, outstanding, and list of owing students
export async function GET(request: Request) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const termId = searchParams.get('termId');
  if (!sessionId || !termId) return NextResponse.json({ error: 'sessionId and termId required' }, { status: 400 });

  // Aggregate expected vs collected per class level
  type StudentRow = { id: string; student_id: string; full_name: string; class_level: string | null; stream: string | null };
  const { data: students, error: studentsErr } = await supabase
    .from('school_students')
    .select('id, student_id, full_name, class_level, stream');
  if (studentsErr) return NextResponse.json({ error: studentsErr.message }, { status: 500 });

  // Expected per student from fee_structures (no dependency on student_charges)
  type FeeStructureRow = { purpose: string; amount: number; class_level: string | null; stream: string | null; is_active: boolean };
  const { data: feeStructures, error: feeErr } = await supabase
    .from('fee_structures')
    .select('purpose, amount, class_level, stream, is_active')
    .eq('session_id', sessionId)
    .eq('term_id', termId)
    .eq('is_active', true);
  if (feeErr) return NextResponse.json({ error: feeErr.message }, { status: 500 });

  // payments per student
  type PaymentRow = { student_id: string; amount: number };
  const { data: payments, error: paymentsErr } = await supabase
    .from('payment_records')
    .select('student_id, amount')
    .eq('session_id', sessionId)
    .eq('term_id', termId);
  if (paymentsErr) return NextResponse.json({ error: paymentsErr.message }, { status: 500 });

  const byStudent = new Map<string, { classLevel: string | null; stream: string | null; studentId: string; studentName: string; expected: number; paid: number }>();
  for (const s of ((students as StudentRow[] | null) || [])) {
    byStudent.set(s.id, {
      classLevel: s.class_level ?? null,
      stream: s.stream ?? null,
      studentId: s.student_id,
      studentName: s.full_name,
      expected: 0,
      paid: 0
    });
  }
  // Compute expected by matching fee structures to each student
  for (const [_sid, entry] of byStudent.entries()) {
    const feesForStudent = ((feeStructures as FeeStructureRow[] | null) || []).filter(f => {
      const fClassRaw = f.class_level as string | null | undefined;
      const fStreamRaw = f.stream as string | null | undefined;
      const studentClassRaw = entry.classLevel as string | null | undefined;
      const studentStreamRaw = entry.stream as string | null | undefined;

      const norm = (v: string | null | undefined) => (v ?? '').toString().trim().toLowerCase();
      const matchesClass = norm(fClassRaw) === norm(studentClassRaw);
      // Stream matching: if fee structure has no stream, it applies to all streams
      // If fee structure has a stream, it must match the student's stream
      const matchesStream = fStreamRaw == null || fStreamRaw === '' || norm(fStreamRaw) === norm(studentStreamRaw);
      return matchesClass && matchesStream;
    });
    const expectedSum = feesForStudent.reduce((acc, f) => acc + Number(f.amount || 0), 0);
    // Assign directly on the existing entry; do not re-key the map to avoid duplicates
    entry.expected = expectedSum;
  }
  for (const p of ((payments as PaymentRow[] | null) || [])) {
    // payment_records.student_id references the student's UUID; the map is keyed by UUID
    const entry = byStudent.get(p.student_id as unknown as string);
    if (entry) {
      entry.paid += Number(p.amount || 0);
    }
  }

  const perClass: Record<string, { expected: number; collected: number; outstanding: number } > = {};
  const owing: Array<{ studentId: string; studentName: string; classLevel: string | null; outstanding: number }> = [];
  for (const [_sid, row] of byStudent.entries()) {
    const classLevel = row.classLevel ?? 'Unknown';
    if (!perClass[classLevel]) perClass[classLevel] = { expected: 0, collected: 0, outstanding: 0 };
    perClass[classLevel].expected += row.expected;
    perClass[classLevel].collected += row.paid;
    perClass[classLevel].outstanding += Math.max(0, row.expected - row.paid);
    const outstanding = row.expected - row.paid;
    if (outstanding > 0) owing.push({ 
      studentId: row.studentId, 
      studentName: row.studentName,
      classLevel: row.classLevel ?? null, 
      outstanding 
    });
  }

  return NextResponse.json({ perClass, owing });
}





