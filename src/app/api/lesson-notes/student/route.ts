import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const classLevel = searchParams.get('class_level');
    const sessionId = searchParams.get('session_id');
    const termId = searchParams.get('term_id');
    const stream = searchParams.get('stream');

    if (!classLevel) return NextResponse.json({ error: 'Class level is required' }, { status: 400 });

    let query = supabase
        .from('lesson_notes')
        .select('*')
        .eq('class_level', classLevel)
        .eq('visible_to_students', true);

    // If student has a stream, show notes for that stream OR general notes (null stream)
    if (stream) {
        query = query.or(`stream.eq.${stream},stream.is.null`);
    }

    if (sessionId) query = query.eq('session_id', sessionId);
    if (termId) query = query.eq('term_id', termId);

    const { data, error } = await query.order('week_number', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
