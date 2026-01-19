import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_SIZE = 300 * 1024;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const teacherId = formData.get('teacher_id') as string;
        const courseId = formData.get('course_id') as string;
        const classLevel = formData.get('class_level') as string;
        const subjectName = formData.get('subject_name') as string;
        const stream = formData.get('stream') as string;
        const termName = formData.get('term_name') as string;
        const sessionName = formData.get('session_name') as string;
        const sessionId = formData.get('session_id') as string;
        const termId = formData.get('term_id') as string;

        const files: { [key: string]: File } = {};
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('week-') && value instanceof File) {
                files[key] = value;
            }
        }

        const results = [];
        for (const [key, file] of Object.entries(files)) {
            const weekNumber = parseInt(key.split('-')[1]);

            if (file.size > MAX_SIZE) {
                results.push({ week: weekNumber, status: 'error', error: 'File too large' });
                continue;
            }

            const fileExt = file.name.split('.').pop();
            const storagePath = `${teacherId}/${classLevel}/${stream || 'general'}/${subjectName}/${sessionName}/${termName}/week-${weekNumber}.${fileExt}`;
            const buffer = Buffer.from(await file.arrayBuffer());

            const { error: uploadError } = await supabase.storage
                .from('lesson-notes')
                .upload(storagePath, buffer, { upsert: true });

            if (uploadError) {
                results.push({ week: weekNumber, status: 'error', error: uploadError.message });
                continue;
            }

            const { data: { publicUrl } } = supabase.storage.from('lesson-notes').getPublicUrl(storagePath);

            const { error: dbError } = await supabase.from('lesson_notes').upsert({
                teacher_id: teacherId,
                course_id: courseId,
                class_level: classLevel,
                subject_name: subjectName,
                stream: stream,
                term_name: termName,
                session_name: sessionName,
                session_id: sessionId,
                term_id: termId,
                week_number: weekNumber,
                title: `Week ${weekNumber} - ${subjectName}`,
                file_url: publicUrl,
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
            });

            if (dbError) {
                results.push({ week: weekNumber, status: 'error', error: dbError.message });
            } else {
                results.push({ week: weekNumber, status: 'success' });
            }
        }

        return NextResponse.json({ results });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
