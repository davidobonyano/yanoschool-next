'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBookOpen,
    faFilter,
    faUpload,
    faPlus,
    faEdit,
    faTrash,
    faEye,
    faEyeSlash,
    faCheckCircle,
    faCircle,
    faFileImport,
    faDownload,
    faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { useAcademicContext } from '@/lib/academic-context';
import { LessonNote, TeacherCourse, MAX_FILE_SIZE } from '@/types/lesson-notes';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/components/ui/notifications';

export default function TeacherLessonNotesPage() {
    const { currentContext } = useAcademicContext();
    const { showSuccessToast, showErrorToast } = useNotifications();
    const [teacher, setTeacher] = useState<any>(null);
    const [courses, setCourses] = useState<TeacherCourse[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [selectedClassFilter, setSelectedClassFilter] = useState<string>('All');
    const [selectedTermFilter, setSelectedTermFilter] = useState<string>('All');
    const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('All');
    const [selectedStreamFilter, setSelectedStreamFilter] = useState<string>('All');
    const [notes, setNotes] = useState<LessonNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<{ week: number, note?: LessonNote } | null>(null);
    const [selectedNoteForView, setSelectedNoteForView] = useState<LessonNote | null>(null);

    useEffect(() => {
        fetchTeacher();
    }, []);

    useEffect(() => {
        if (currentContext) {
            if (selectedTermFilter === 'All') setSelectedTermFilter(currentContext.term_name);
            if (selectedSessionFilter === 'All') setSelectedSessionFilter(currentContext.session_id || 'All');
        }
    }, [currentContext]);

    useEffect(() => {
        if (teacher) {
            fetchCourses();
        }
    }, [teacher]);

    useEffect(() => {
        if (selectedCourseId && currentContext && teacher?.id) {
            fetchNotes();
        }
    }, [selectedCourseId, currentContext, teacher]);

    const fetchTeacher = async () => {
        try {
            const res = await fetch('/api/teachers/me');
            if (res.ok) {
                const data = await res.json();
                // Normalize teacher object to always have .id
                const t = data.teacher;
                if (t && !t.id && t.teacher_id) t.id = t.teacher_id;
                setTeacher(t);
            }
        } catch (err) {
            console.error('Failed to fetch teacher:', err);
        }
    };

    const fetchCourses = async () => {
        const tId = teacher.id || teacher.teacher_id;
        const res = await fetch(`/api/lesson-notes/teacher-courses?teacher_id=${tId}`);
        if (res.ok) {
            let data = await res.json();
            // Consistent stream names
            data = data.map((c: any) => ({
                ...c,
                stream: c.stream ? (
                    /^arts?$/i.test(c.stream) ? 'Arts' :
                        /^science$/i.test(c.stream) ? 'Science' :
                            /^commercial$/i.test(c.stream) ? 'Commercial' : c.stream.trim()
                ) : c.stream
            }));
            setCourses(data);
        }
    };

    const fetchNotes = async () => {
        const tId = teacher?.id || teacher?.teacher_id;
        if (!tId || !selectedCourseId || !currentContext) return;
        setLoading(true);
        const res = await fetch(
            `/api/lesson-notes?course_id=${selectedCourseId}&session_id=${currentContext?.session_id}&term_id=${currentContext?.term_id}`
        );
        if (res.ok) {
            const data = await res.json();
            setNotes(data);
        }
        setLoading(false);
    };

    const handleFileUpload = async (week: number, file: File) => {
        const course = courses.find(c => c.id === selectedCourseId);
        if (!course || !currentContext || !teacher) return;

        if (file.size > MAX_FILE_SIZE) {
            showErrorToast('File too large. Max 300KB.');
            return;
        }

        const tId = teacher.id || teacher.teacher_id;
        setUploading(week);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('teacher_id', tId);
            formData.append(
                'path',
                `${course.class_level}/${course.stream || 'general'}/${course.name}/${currentContext.session_name}/${currentContext.term_name}/week-${week}.${file.name.split('.').pop()}`
            );

            const uploadRes = await fetch('/api/lesson-notes/upload', {
                method: 'POST',
                body: formData
            });

            if (uploadRes.ok) {
                const fileData = await uploadRes.json();
                const res = await fetch('/api/lesson-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        teacher_id: tId,
                        course_id: selectedCourseId,
                        class_level: course.class_level,
                        subject_name: course.name,
                        subject_code: course.code,
                        stream: course.stream,
                        term_id: currentContext.term_id,
                        session_id: currentContext.session_id,
                        term_name: currentContext.term_name,
                        session_name: currentContext.session_name,
                        week_number: week,
                        title: `Week ${week} - ${course.name}`,
                        file_url: fileData.url,
                        file_name: fileData.name,
                        file_size: fileData.size,
                        file_type: fileData.type,
                        visible_to_students: false
                    })
                });

                if (res.ok) {
                    showSuccessToast(`Week ${week} note uploaded`);
                    fetchNotes();
                } else {
                    const err = await res.json();
                    showErrorToast(err.error || 'Failed to save note after upload');
                }
            } else {
                const err = await uploadRes.json();
                showErrorToast(err.error || 'Upload failed');
            }
        } catch (err: any) {
            showErrorToast(err.message || 'Error occurred during upload');
        } finally {
            setUploading(null);
        }
    };

    const toggleVisibility = async (note: LessonNote) => {
        try {
            const res = await fetch('/api/lesson-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...note,
                    visible_to_students: !note.visible_to_students
                })
            });

            if (res.ok) {
                showSuccessToast(note.visible_to_students ? 'Note hidden' : 'Note is now LIVE');
                fetchNotes();
            } else {
                const err = await res.json();
                showErrorToast(err.error || 'Failed to update visibility');
            }
        } catch (err: any) {
            showErrorToast(err.message || 'Error toggling visibility');
        }
    };

    const deleteNote = async (id: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;
        try {
            const res = await fetch(`/api/lesson-notes?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showSuccessToast('Note deleted');
                fetchNotes();
            } else {
                showErrorToast('Failed to delete note');
            }
        } catch (err: any) {
            showErrorToast(err.message || 'Delete error');
        }
    };

    const selectedCourse = courses.find(c => c.id === selectedCourseId);

    return (
        <div className="p-8 bg-blue-50/50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Lesson Notes</h1>
                        <p className="text-slate-600">Plan and manage your weekly lesson notes.</p>
                    </div>
                    <button
                        onClick={() => setIsBulkModalOpen(true)}
                        disabled={!selectedCourseId}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-700 to-blue-900 text-white rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faFileImport} />
                        Bulk Upload
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Filters */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="mb-4">
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    <FontAwesomeIcon icon={faFilter} className="mr-2" />
                                    Filter by Class
                                </h2>
                                <select
                                    value={selectedClassFilter}
                                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-700 font-bold focus:border-blue-200 focus:outline-none transition-all"
                                >
                                    <option value="All">All Classes</option>
                                    {Array.from(new Set(courses.map(c => c.class_level)))
                                        .sort()
                                        .map(cls => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="mb-4">
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    <FontAwesomeIcon icon={faFilter} className="mr-2" />
                                    Filter by Term
                                </h2>
                                <select
                                    value={selectedTermFilter}
                                    onChange={(e) => setSelectedTermFilter(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-700 font-bold focus:border-blue-200 focus:outline-none transition-all"
                                >
                                    <option value="All">All Terms</option>
                                    {Array.from(new Set(courses.map(c => c.term)))
                                        .sort()
                                        .map(t => (
                                            <option key={t} value={t}>{t} Term</option>
                                        ))
                                    }
                                </select>
                            </div>

                            {selectedClassFilter.startsWith('SS') && (
                                <div className="mb-6">
                                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        <FontAwesomeIcon icon={faFilter} className="mr-2" />
                                        Filter by Stream
                                    </h2>
                                    <select
                                        value={selectedStreamFilter}
                                        onChange={(e) => setSelectedStreamFilter(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-700 font-bold focus:border-blue-200 focus:outline-none transition-all"
                                    >
                                        <option value="All">All Streams</option>
                                        {Array.from(new Set(courses
                                            .filter(c => c.stream && c.class_level === selectedClassFilter)
                                            .map(c => c.stream!)))
                                            .sort()
                                            .map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            )}

                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                                Select Subject
                            </h2>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {courses
                                    .filter(c => {
                                        const matchesClass = selectedClassFilter === 'All' || c.class_level === selectedClassFilter;
                                        const matchesTerm = selectedTermFilter === 'All' || c.term === selectedTermFilter;
                                        const matchesSession = selectedSessionFilter === 'All' || !c.session_id || c.session_id === selectedSessionFilter;
                                        const matchesStream = selectedStreamFilter === 'All' || c.stream === selectedStreamFilter;
                                        return matchesClass && matchesTerm && matchesSession && matchesStream;
                                    })
                                    .map(course => (
                                        <button
                                            key={course.id}
                                            onClick={() => setSelectedCourseId(course.id)}
                                            className={`w-full text-left p-4 rounded-xl transition-all ${selectedCourseId === course.id
                                                ? 'bg-blue-50 text-blue-700 border-2 border-blue-200'
                                                : 'hover:bg-slate-50 text-slate-700 border-2 border-transparent'
                                                }`}
                                        >
                                            <div className="font-bold text-lg">{course.name}</div>
                                            <div className="text-sm opacity-60">
                                                {course.class_level}{course.stream ? ` (${course.stream})` : ''} • {course.code}
                                                <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold">
                                                    {course.term} Term
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </div>

                        {selectedCourse && (
                            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 p-6 rounded-2xl text-white shadow-xl">
                                <div className="text-blue-200 text-xs font-bold uppercase mb-2">Academic Context</div>
                                <div className="text-xl font-bold mb-4">{currentContext?.session_name}</div>
                                <div className="flex items-center gap-2 py-2 px-3 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    <span className="text-sm font-medium">{currentContext?.term_name}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 12-Week Grid */}
                    <div className="lg:col-span-3">
                        {selectedCourseId ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {Array.from({ length: 12 }, (_, i) => {
                                    const week = i + 1;
                                    const note = notes.find(n => n.week_number === week);
                                    return (
                                        <div
                                            key={week}
                                            className={`
                                                relative group overflow-hidden rounded-2xl border-2 transition-all p-5
                                                ${note
                                                    ? 'bg-white border-slate-100 shadow-sm hover:border-blue-200'
                                                    : 'bg-white/50 border-dashed border-slate-300 hover:bg-white hover:border-blue-400'
                                                }
                                            `}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">
                                                    WEEK {week}
                                                </div>
                                                {note && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleVisibility(note);
                                                            }}
                                                            title={note.visible_to_students ? "Hide from students" : "Show to students"}
                                                            className={`p-2 rounded-lg transition-colors ${note.visible_to_students ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`}
                                                        >
                                                            <FontAwesomeIcon icon={note.visible_to_students ? faEye : faEyeSlash} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingNote({ week, note });
                                                            }}
                                                            className="p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                                                            title="Edit note"
                                                        >
                                                            <FontAwesomeIcon icon={faEdit} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNote(note.id);
                                                            }}
                                                            className="p-2 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                                            title="Delete note"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {note ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 mb-1">{note.title}</h3>
                                                        <div className="text-xs text-slate-400 flex items-center gap-2">
                                                            {note.file_name ? (
                                                                <span className="flex items-center gap-1 text-blue-600 font-medium">
                                                                    📎 {note.file_name}
                                                                </span>
                                                            ) : (
                                                                <span>Typed content</span>
                                                            )}
                                                            <span>• {new Date(note.updated_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                                        <div className={`text-[10px] font-black uppercase tracking-widest ${note.visible_to_students ? 'text-green-500' : 'text-slate-300'}`}>
                                                            {note.visible_to_students ? 'Live on Portal' : 'Draft Mode'}
                                                        </div>
                                                        <button
                                                            onClick={() => setSelectedNoteForView(note)}
                                                            className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all"
                                                        >
                                                            View <FontAwesomeIcon icon={faPlus} className="scale-75 rotate-45" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => setEditingNote({ week })}
                                                    className="py-10 text-center flex flex-col items-center gap-4 cursor-pointer"
                                                >
                                                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 group-hover:border-blue-400 group-hover:text-blue-500 transition-all">
                                                        <FontAwesomeIcon icon={faPlus} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="font-bold text-slate-400 group-hover:text-slate-900 transition-colors">Add Note</div>
                                                        <div className="text-[10px] text-slate-400 uppercase tracking-tighter">TYPE CONTENT OR UPLOAD</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-96 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                    <FontAwesomeIcon icon={faBookOpen} size="2x" className="opacity-20" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">No Subject Selected</h3>
                                <p className="max-w-xs mx-auto">Please pick a subject from the left panel to start managing lesson notes for this term.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {editingNote && (
                    <NoteEditorModal
                        week={editingNote.week}
                        note={editingNote.note}
                        teacher={teacher}
                        course={selectedCourse!}
                        currentContext={currentContext!}
                        showSuccessToast={showSuccessToast}
                        showErrorToast={showErrorToast}
                        onClose={() => setEditingNote(null)}
                        onSuccess={() => {
                            fetchNotes();
                            setEditingNote(null);
                        }}
                    />
                )}
                {isBulkModalOpen && (
                    <BulkUploadModal
                        onClose={() => setIsBulkModalOpen(false)}
                        teacher={teacher}
                        course={selectedCourse!}
                        currentContext={currentContext!}
                        showSuccessToast={showSuccessToast}
                        showErrorToast={showErrorToast}
                        onSuccess={() => {
                            fetchNotes();
                            setIsBulkModalOpen(false);
                        }}
                    />
                )}
                {selectedNoteForView && (
                    <NoteViewerModal
                        note={selectedNoteForView}
                        onClose={() => setSelectedNoteForView(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}


function NoteViewerModal({ note, onClose }: { note: LessonNote, onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                            Week {note.week_number} • {note.subject_name}
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">
                            {note.title || 'Lesson Content'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-full bg-white shadow-sm text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1">
                    {note.content ? (
                        <div className="prose prose-slate max-w-none">
                            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                {note.content}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic">
                            <FontAwesomeIcon icon={faBookOpen} size="3x" className="mb-4 opacity-10" />
                            <p>No typed content for this week.</p>
                        </div>
                    )}
                </div>

                {note.file_url && (
                    <div className="p-8 bg-white border-t border-slate-100 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                            <FontAwesomeIcon icon={faDownload} className="text-blue-500" />
                            Attachment: {note.file_name}
                        </div>
                        <a
                            href={note.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl font-bold hover:shadow-blue-500/30 transition-all shadow-xl"
                        >
                            View / Download Material
                        </a>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

function NoteEditorModal({ week, note, teacher, course, currentContext, showSuccessToast, showErrorToast, onClose, onSuccess }: any) {
    const [title, setTitle] = useState(note?.title || `Week ${week} - ${course.name}`);
    const [content, setContent] = useState(note?.content || '');
    const [file, setFiles] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!title.trim()) {
            showErrorToast('Title is required');
            return;
        }

        setLoading(true);
        try {
            let fileData = note ? {
                url: note.file_url,
                name: note.file_name,
                size: note.file_size,
                type: note.file_type
            } : null;

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('teacher_id', teacher.id);
                formData.append(
                    'path',
                    `${course.class_level}/${course.stream || 'general'}/${course.name}/${currentContext.session_name}/${currentContext.term_name}/week-${week}.${file.name.split('.').pop()}`
                );

                const uploadRes = await fetch('/api/lesson-notes/upload', {
                    method: 'POST',
                    body: formData
                });

                if (uploadRes.ok) {
                    fileData = await uploadRes.json();
                } else {
                    const err = await uploadRes.json();
                    throw new Error(err.error || 'File upload failed');
                }
            }

            const tId = teacher.id || teacher.teacher_id;

            const res = await fetch('/api/lesson-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: note?.id,
                    teacher_id: tId,
                    course_id: course.id,
                    class_level: course.class_level,
                    subject_name: course.name,
                    subject_code: course.code,
                    stream: course.stream,
                    term_id: currentContext.term_id,
                    session_id: currentContext.session_id,
                    term_name: currentContext.term_name,
                    session_name: currentContext.session_name,
                    week_number: week,
                    title,
                    content,
                    file_url: fileData?.url,
                    file_name: fileData?.name,
                    file_size: fileData?.size,
                    file_type: fileData?.type,
                    visible_to_students: note?.visible_to_students ?? false
                })
            });

            if (res.ok) {
                showSuccessToast('Lesson note saved successfully');
                onSuccess();
            } else {
                const err = await res.json();
                console.error('Save Note Error:', err);
                showErrorToast(err.error || 'Failed to save note');
            }
        } catch (err: any) {
            console.error('Error in handleSave:', err);
            showErrorToast(err.message || 'An error occurred while saving');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{note ? 'Edit' : 'Add'} Lesson Note</h2>
                        <p className="text-slate-500">Week {week} • {course.name} {course.stream ? `(${course.stream})` : ''}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 text-slate-400 transition-colors flex items-center justify-center">
                        <FontAwesomeIcon icon={faPlus} className="rotate-45" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Note Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Introduction to Algebra"
                            className="w-full p-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-blue-400 focus:outline-none font-medium transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Lesson Content (Typed)</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Type or paste your lesson content here..."
                            rows={8}
                            className="w-full p-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-blue-400 focus:outline-none font-medium transition-all resize-none"
                        ></textarea>
                        <p className="text-xs text-slate-400 mt-2">You can paste formatted text or simple notes here.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Attach File (Optional)</label>
                        <div className={`relative p-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${file || note?.file_name ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <FontAwesomeIcon icon={faUpload} />
                            <span className="text-sm font-bold">
                                {file ? file.name : (note?.file_name || 'Click to upload PDF, Word, or PPT')}
                            </span>
                            <input
                                type="file"
                                onChange={(e) => {
                                    const selected = e.target.files?.[0];
                                    if (selected && selected.size > MAX_FILE_SIZE) {
                                        alert('File too large (max 300KB)');
                                        return;
                                    }
                                    setFiles(selected || null);
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept=".pdf,.docx,.doc,.pptx,.ppt"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 font-bold text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || (!title && !content && !file && !note)}
                        className="px-10 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Note'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function BulkUploadModal({ onClose, teacher, course, currentContext, showSuccessToast, showErrorToast, onSuccess }: any) {
    const [files, setFiles] = useState<{ [key: number]: File }>({});
    const [loading, setLoading] = useState(false);

    const handleFileChange = (week: number, file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            showErrorToast(`File for Week ${week} is too large (max 300KB)`);
            return;
        }
        setFiles(prev => ({ ...prev, [week]: file }));
    };

    const handleUpload = async () => {
        const tId = teacher.id || teacher.teacher_id;
        if (!tId) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('teacher_id', tId);
            formData.append('course_id', course.id);
            formData.append('class_level', course.class_level);
            formData.append('subject_name', course.name);
            formData.append('subject_code', course.code || '');
            if (course.stream) formData.append('stream', course.stream);
            formData.append('term_name', currentContext.term_name);
            formData.append('session_name', currentContext.session_name);
            formData.append('session_id', currentContext.session_id);
            formData.append('term_id', currentContext.term_id);

            Object.entries(files).forEach(([week, file]) => {
                formData.append(`week-${week}`, file);
            });

            const res = await fetch('/api/lesson-notes/bulk-upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                showSuccessToast('Bulk upload successful');
                onSuccess();
            } else {
                const err = await res.json();
                showErrorToast(err.error || 'Upload failed');
            }
        } catch (err: any) {
            showErrorToast(err.message || 'Error occurred during bulk upload');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Bulk Upload Notes</h2>
                        <p className="text-slate-500">{course.name} • {course.class_level} {course.stream ? `(${course.stream})` : ''}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                        <FontAwesomeIcon icon={faPlus} className="rotate-45" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 12 }, (_, i) => {
                        const week = i + 1;
                        return (
                            <div key={week} className={`p-4 rounded-2xl border-2 transition-all ${files[week] ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-black text-slate-400">WEEK {week}</span>
                                    {files[week] && <FontAwesomeIcon icon={faCheckCircle} className="text-blue-500" />}
                                </div>
                                <div className="relative">
                                    <div className="text-sm font-bold truncate">
                                        {files[week] ? files[week].name : 'Drop file here'}
                                    </div>
                                    <input
                                        type="file"
                                        onChange={(e) => e.target.files?.[0] && handleFileChange(week, e.target.files[0])}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 font-bold text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={loading || Object.keys(files).length === 0}
                        className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Uploading...' : `Upload ${Object.keys(files).length} Notes`}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
