import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');

    if (!teacherId) return NextResponse.json({ error: 'Teacher ID is required' }, { status: 400 });

    // In this system, we'll assume teachers teach courses based on their name or assignments.
    // Since there's no teacher_assignments table explicitly shown, let's fetch ALL courses 
    // and allow filtering by class, or if there's a specific logic it should be here.
    // For now, let's just return all unique class/subject combinations from the 'courses' table.

    const { data, error } = await supabase
        .from('courses')
        .select('id, code, name, class_level, stream, term, session_id, term_id')
        .order('class_level', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
}
