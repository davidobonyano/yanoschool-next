import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch notes
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');
    const courseId = searchParams.get('course_id');
    const classLevel = searchParams.get('class_level');
    const sessionId = searchParams.get('session_id');
    const termId = searchParams.get('term_id');
    const stream = searchParams.get('stream');

    let query = supabase.from('lesson_notes').select('*');

    if (teacherId && teacherId !== 'undefined' && teacherId !== 'null') {
        query = query.eq('teacher_id', teacherId);
    }
    if (courseId) query = query.eq('course_id', courseId);
    if (classLevel) query = query.eq('class_level', classLevel);
    if (sessionId) query = query.eq('session_id', sessionId);
    if (termId) query = query.eq('term_id', termId);
    if (stream && stream !== 'All') query = query.eq('stream', stream);

    const { data, error } = await query.order('week_number', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// POST: Create or Update note
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id,
            teacher_id,
            course_id,
            class_level,
            subject_name,
            stream,
            term_id,
            session_id,
            term_name,
            session_name,
            week_number,
            ...rest
        } = body;

        if (!teacher_id || !class_level || !subject_name || !term_name || !session_name || !week_number) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const upsertData: any = {
            teacher_id,
            course_id,
            class_level,
            subject_name,
            stream,
            term_id,
            session_id,
            term_name,
            session_name,
            week_number,
            ...rest,
            updated_at: new Date().toISOString()
        };

        // If explicitly passing an ID for an update
        if (id) upsertData.id = id;

        // Use upsert with a more explicit onConflict
        // We prefer to conflict on the course_id unique constraint if course_id exists
        const conflictColumns = course_id
            ? 'course_id,term_id,session_id,week_number'
            : 'class_level,stream,subject_name,term_name,session_name,week_number';

        const { data, error } = await supabase
            .from('lesson_notes')
            .upsert(upsertData, {
                onConflict: conflictColumns
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase Upsert Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error('API Route Error:', err);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}

// DELETE: Remove a note
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase.from('lesson_notes').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
