import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_SIZE = 300 * 1024; // 300 KB

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const teacherId = formData.get('teacher_id') as string;
        const path = formData.get('path') as string; // e.g., "class/subject/session/term/week-1.pdf"

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 300KB)' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${teacherId}/${path}`;

        const { data, error } = await supabase.storage
            .from('lesson-notes')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const { data: { publicUrl } } = supabase.storage
            .from('lesson-notes')
            .getPublicUrl(fileName);

        return NextResponse.json({ url: publicUrl, name: file.name, size: file.size, type: file.type });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
