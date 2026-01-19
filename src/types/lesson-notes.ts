export interface LessonNote {
    id: string;
    teacher_id: string;
    course_id?: string | null;
    class_level: string;
    subject_name: string;
    subject_code?: string | null;
    stream?: string | null;
    term_id?: string | null;
    session_id?: string | null;
    term_name: string;
    session_name: string;
    week_number: number;
    title: string;
    content?: string | null;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    file_type?: string | null;
    visible_to_students: boolean;
    created_at: string;
    updated_at: string;
}

export interface TeacherCourse {
    id: string;
    code: string;
    name: string;
    class_level: string;
    stream?: string | null;
    term: string;
    session_id?: string | null;
    term_id?: string | null;
}

export const MAX_FILE_SIZE = 300 * 1024; // 300 KB
export const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];
