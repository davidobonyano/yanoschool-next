import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/courses/registrations/reset - Bulk reset registrations for a term/session
export async function POST(request: NextRequest) {
	try {
		const body = await request.json().catch(() => ({}));
		const termRaw = body.term as string | undefined;
		const session = body.session as string | undefined;
		const classLevel = body.class_level as string | undefined;
		const studentId = body.student_id as string | undefined;

		// Normalize term to First/Second/Third if raw provided in various formats
		const normalizeTerm = (t?: string) => {
			const s = String(t || '').toLowerCase();
			if (!s) return undefined;
			if (s.includes('third') || s.includes('3rd') || s.startsWith('3')) return 'Third';
			if (s.includes('second') || s.includes('2nd') || s.startsWith('2')) return 'Second';
			return 'First';
		};
		const getTermAliases = (n?: string) => {
			const norm = normalizeTerm(n);
			if (norm === 'First') return ['First', '1st Term', 'First Term', '1st'];
			if (norm === 'Second') return ['Second', '2nd Term', 'Second Term', '2nd'];
			return ['Third', '3rd Term', 'Third Term', '3rd'];
		};
		const term = normalizeTerm(termRaw);

		if (!term || !session) {
			return NextResponse.json(
				{ error: 'term and session are required' },
				{ status: 400 }
			);
		}

		// Delete by names first (term/session string columns)
		{
			let nameDelete = supabase
				.from('student_course_registrations')
				.delete()
				.in('term', getTermAliases(term))
				.eq('session', session);
			if (classLevel) nameDelete = nameDelete.eq('class_level', classLevel);
			if (studentId) nameDelete = nameDelete.eq('student_id', studentId);
			const { error: nameDeleteError } = await nameDelete;
			if (nameDeleteError) {
				console.warn('Name-based reset failed, will attempt id-based:', nameDeleteError.message);
			}
		}

		// Resolve current session/term IDs and delete by ids as well
		try {
			// Try to fetch the specific session/term IDs matching provided names
			let sessionId: string | null = null;
			let termId: string | null = null;

			const { data: sessionRow } = await supabase
				.from('academic_sessions')
				.select('id, name')
				.eq('name', session)
				.maybeSingle();
			sessionId = (sessionRow as any)?.id || null;

			if (sessionId) {
				const { data: termRow } = await supabase
					.from('academic_terms')
					.select('id, name')
					.eq('name', term)
					.eq('session_id', sessionId)
					.maybeSingle();
				termId = (termRow as any)?.id || null;
			}

			if (sessionId || termId) {
				let idDelete = supabase
					.from('student_course_registrations')
					.delete();
				if (sessionId) idDelete = idDelete.eq('session_id', sessionId);
				if (termId) idDelete = idDelete.eq('term_id', termId);
				if (classLevel) idDelete = idDelete.eq('class_level', classLevel);
				if (studentId) idDelete = idDelete.eq('student_id', studentId);
				const { error: idDeleteError } = await idDelete;
				if (idDeleteError) {
					console.error('ID-based reset failed:', idDeleteError);
					return NextResponse.json(
						{ error: 'Failed to reset registrations' },
						{ status: 500 }
					);
				}
			}
		} catch (e) {
			console.warn('ID lookup for reset failed:', e instanceof Error ? e.message : e);
		}

		return NextResponse.json({ message: 'Registrations reset completed' });
	} catch (error) {
		console.error('Error in registrations reset:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}


