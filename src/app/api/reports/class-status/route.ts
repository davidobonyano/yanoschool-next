import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type StudentLite = {
	student_id: string;
	full_name: string;
	class_level: string;
	stream: string | null;
};

type ClassStatusRow = {
	student_id: string;
	full_name: string;
	class_level: string;
	stream: string | null;
	outstanding: number;
	status: 'Outstanding' | 'Paid';
};

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const term = searchParams.get('term');
		const session = searchParams.get('session');
		if (!term || !session) return NextResponse.json({ error: 'term and session are required' }, { status: 400 });

		// fetch students and compute balances via RPC in parallel
		const { data: students, error: sErr } = await supabase
			.from('school_students')
			.select('student_id, full_name, class_level, stream')
			.eq('is_active', true);
		if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

		const results: ClassStatusRow[] = [];
		for (const s of ((students as StudentLite[] | null) || [])) {
			const { data: bal, error: bErr } = await supabase.rpc('get_student_balance', {
				p_student_id: s.student_id,
				p_term: term,
				p_session: session
			});
			if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
			const outstanding = Array.isArray(bal) ? Number((bal as unknown[])[0]) : Number(bal as unknown);
			results.push({
				student_id: s.student_id,
				full_name: s.full_name,
				class_level: s.class_level,
				stream: s.stream,
				outstanding,
				status: outstanding > 0 ? 'Outstanding' : 'Paid'
			});
		}

		// group by class/stream client-side
		const grouped: Record<string, ClassStatusRow[]> = {};
		for (const r of results) {
			const key = `${r.class_level}${r.stream ? ' - ' + r.stream : ''}`;
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(r);
		}
		return NextResponse.json({ groups: grouped });
	} catch (err: unknown) {
		const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}








