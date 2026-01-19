# Lesson Notes Feature - Implementation Plan

## Overview
Weekly lesson notes system for teachers to create, manage, and share lesson content with students.

## Database Schema

### Table: `lesson_notes`
```sql
CREATE TABLE lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  
  -- Link to course
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  class_level TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  subject_code TEXT,
  
  -- Academic period (from academic context)
  term_id UUID,
  session_id UUID,
  term_name TEXT NOT NULL,
  session_name TEXT NOT NULL,
  
  -- Week (1-12)
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 12),
  
  -- Content
  title TEXT NOT NULL,
  content TEXT, -- Rich text content
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  
  -- Visibility
  visible_to_students BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One note per week/course/term/session
  UNIQUE(course_id, term_id, session_id, week_number)
);
```

## Key Features

1. **Fetch from Courses**: Dropdowns populated from actual `courses` table
2. **Filter by Teacher**: Show only courses teacher can access
3. **Academic Context Integration**: Use current session/term from academic context
4. **Weekly Structure**: 12 weeks per term
5. **File Upload**: Max 300KB (PDF, DOCX, PPTX)
6. **Visibility Control**: Teachers toggle student access
7. **Bulk Upload**: Upload all 12 weeks at once

## API Endpoints

1. `/api/lesson-notes` - CRUD operations
2. `/api/lesson-notes/upload` - Single file upload
3. `/api/lesson-notes/bulk-upload` - Bulk file upload
4. `/api/lesson-notes/teacher-courses` - Get teacher's courses for filters
5. `/api/lesson-notes/student` - Student view (visible notes only)

## UI Flow

### Teacher Dashboard
1. Select Course (from their courses)
2. View 12-week grid
3. Create/Edit/Delete notes per week
4. Toggle visibility
5. Bulk upload option

### Student Portal
1. View by subject
2. See only visible notes
3. Download files
4. Track weekly progress
