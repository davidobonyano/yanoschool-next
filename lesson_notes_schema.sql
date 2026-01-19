-- ============================================
-- LESSON NOTES FEATURE - DATABASE SCHEMA
-- ============================================

-- Create lesson_notes table
CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  
  -- Link to course
  course_id UUID REFERENCES public.courses(id),
  class_level VARCHAR(50) NOT NULL,
  stream VARCHAR(50), -- New: For SS class segments (Science, Arts, etc.)
  subject_name VARCHAR(255) NOT NULL,
  subject_code VARCHAR(50),
  
  -- Academic period (from academic context)
  term_id UUID,
  session_id UUID,
  term_name VARCHAR(50) NOT NULL,
  session_name VARCHAR(100) NOT NULL,
  
  -- Week (1-12)
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 12),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  content TEXT, -- Rich text content (typed notes)
  
  -- File attachment (optional)
  file_url TEXT, -- Supabase Storage URL
  file_name VARCHAR(255),
  file_size INTEGER, -- in bytes
  file_type VARCHAR(100), -- pdf, docx, pptx
  
  -- Visibility control
  visible_to_students BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates: one note per week/course/term/session
  -- If course_id is null, fallback to combination of text fields
  CONSTRAINT unique_weekly_note_by_course UNIQUE(course_id, term_id, session_id, week_number),
  CONSTRAINT unique_weekly_note_by_text UNIQUE(class_level, stream, subject_name, term_name, session_name, week_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_notes_teacher ON public.lesson_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_course ON public.lesson_notes(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_class_term ON public.lesson_notes(class_level, term_name, session_name);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_week ON public.lesson_notes(week_number);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_visible ON public.lesson_notes(visible_to_students);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_lesson_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lesson_notes_updated_at ON public.lesson_notes;
CREATE TRIGGER trg_lesson_notes_updated_at
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lesson_notes_updated_at();

-- Enable RLS
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Teachers can manage own notes" ON public.lesson_notes;
CREATE POLICY "Teachers can manage own notes" ON public.lesson_notes
  FOR ALL USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Students can view visible notes" ON public.lesson_notes;
CREATE POLICY "Students can view visible notes" ON public.lesson_notes
  FOR SELECT USING (visible_to_students = true);

-- Storage Bucket Setup
-- You must create a bucket named 'lesson-notes' in Supabase Storage dashboard
-- with public access disabled (private) and the following policies:

/*
-- INSERT Policy: Allow teachers to upload files to their own path
CREATE POLICY "Teachers can upload files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lesson-notes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT Policy: Allow teachers to view their files and students to view visible notes' files
-- (Students usually need a signed URL or a more open policy if we want it direct)
CREATE POLICY "Authenticated users can view lesson notes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lesson-notes' AND
    auth.role() = 'authenticated'
  );
*/
