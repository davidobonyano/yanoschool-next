'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBookOpen,
    faCheckCircle,
    faCircle,
    faDownload,
    faChevronRight,
    faEye,
    faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { useAcademicContext } from '@/lib/academic-context';
import { getStudentSession } from '@/lib/student-session';
import { LessonNote } from '@/types/lesson-notes';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentLessonNotesPage() {
    const { currentContext } = useAcademicContext();
    const [student, setStudent] = useState<any>(null);
    const [notes, setNotes] = useState<LessonNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

    const [selectedNote, setSelectedNote] = useState<LessonNote | null>(null);

    useEffect(() => {
        const s = getStudentSession();
        if (s) {
            setStudent(s);
        }
    }, []);

    useEffect(() => {
        if (student && currentContext) {
            fetchNotes();
        }
    }, [student, currentContext]);

    const fetchNotes = async () => {
        setLoading(true);
        const normalizedStream = student.stream ? (
            /^arts?$/i.test(student.stream) ? 'Arts' :
                /^science$/i.test(student.stream) ? 'Science' :
                    /^commercial$/i.test(student.stream) ? 'Commercial' : student.stream.trim()
        ) : '';

        const res = await fetch(
            `/api/lesson-notes/student?class_level=${student.class_level}&session_id=${currentContext?.session_id}&term_id=${currentContext?.term_id}${normalizedStream ? `&stream=${normalizedStream}` : ''}`
        );
        if (res.ok) {
            const data = await res.json();
            setNotes(data);
        }
        setLoading(false);
    };

    const groupedNotes = notes.reduce((acc: any, note) => {
        const key = note.subject_name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(note);
        return acc;
    }, {});

    const subjectList = Object.keys(groupedNotes);

    if (loading) return <div className="p-10 text-center text-slate-400">Loading your notes...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <div className="max-w-5xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">My Lesson Notes</h1>
                    <p className="text-slate-600">Access your weekly learning materials and track your progress.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Subjects Sidebar */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">Subjects</h2>
                        <div className="space-y-2">
                            {subjectList.map(subject => {
                                const subjectNotes = groupedNotes[subject];
                                const progress = (subjectNotes.length / 12) * 100;

                                return (
                                    <button
                                        key={subject}
                                        onClick={() => setSelectedSubject(subject)}
                                        className={`w-full text-left p-5 rounded-2xl transition-all border-2 ${selectedSubject === subject
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-500/20'
                                            : 'bg-white text-slate-700 border-white hover:border-blue-100 hover:bg-white'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="font-bold text-lg leading-tight">{subject}</div>
                                                {subjectNotes[0]?.stream && (
                                                    <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter mt-1">
                                                        {subjectNotes[0].stream} STREAM
                                                    </div>
                                                )}
                                            </div>
                                            <FontAwesomeIcon icon={faChevronRight} className={`mt-1 ${selectedSubject === subject ? 'opacity-100' : 'opacity-20'}`} />
                                        </div>
                                        <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                className={`h-full ${selectedSubject === subject ? 'bg-white' : 'bg-blue-500'}`}
                                            />
                                        </div>
                                        <div className={`text-[10px] uppercase font-black mt-2 tracking-wider ${selectedSubject === subject ? 'text-blue-100' : 'text-slate-400'}`}>
                                            {subjectNotes.length} OF 12 WEEKS AVAILABLE
                                        </div>
                                    </button>
                                );
                            })}
                            {subjectList.length === 0 && (
                                <div className="p-10 bg-white rounded-3xl text-center text-slate-300 border-2 border-dashed border-slate-100 italic">
                                    No notes available yet for this term.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notes Grid */}
                    <div className="lg:col-span-2">
                        <AnimatePresence mode="wait">
                            {selectedSubject ? (
                                <motion.div
                                    key={selectedSubject}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-2xl font-bold text-slate-900">{selectedSubject}</h2>
                                        <span className="text-sm font-medium text-slate-400">{groupedNotes[selectedSubject].length} Notes released</span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const week = i + 1;
                                            const note = groupedNotes[selectedSubject].find((n: LessonNote) => n.week_number === week);

                                            return (
                                                <div
                                                    key={week}
                                                    className={`
                            p-5 rounded-2xl border-2 transition-all flex items-center justify-between
                            ${note ? 'bg-white border-white shadow-sm hover:border-blue-200' : 'bg-slate-100/50 border-transparent opacity-50'}
                          `}
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${note ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                                            {week}
                                                        </div>
                                                        <div>
                                                            <div className={`font-bold ${note ? 'text-slate-900' : 'text-slate-400'}`}>
                                                                {note ? (note.title || `Week ${week}`) : `Week ${week} Content`}
                                                            </div>
                                                            <div className="text-xs text-slate-400">
                                                                {note ? `Updated ${new Date(note.updated_at).toLocaleDateString()}` : 'Not yet available'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {note ? (
                                                        <div className="flex gap-2">
                                                            {note.content && (
                                                                <button
                                                                    onClick={() => setSelectedNote(note)}
                                                                    className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                                    title="Read Note"
                                                                >
                                                                    <FontAwesomeIcon icon={faEye} />
                                                                </button>
                                                            )}
                                                            {note.file_url && (
                                                                <a
                                                                    href={note.file_url}
                                                                    target="_blank"
                                                                    className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                                    title="Download Attachment"
                                                                >
                                                                    <FontAwesomeIcon icon={faDownload} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Locked</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-20 text-center text-slate-300 bg-white rounded-3xl border-2 border-dashed border-slate-50">
                                    <FontAwesomeIcon icon={faBookOpen} size="3x" className="mb-6 opacity-10" />
                                    <h3 className="text-xl font-bold text-slate-400 mb-2">Take a subject!</h3>
                                    <p className="max-w-xs mx-auto">Click on a subject on the left to see your weekly lesson notes.</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Note Viewer Modal */}
            <AnimatePresence>
                {selectedNote && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedNote(null)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                                <div>
                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                                        Week {selectedNote.week_number} • {selectedNote.subject_name}
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900">
                                        {selectedNote.title || 'Lesson Content'}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setSelectedNote(null)}
                                    className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all"
                                >
                                    <FontAwesomeIcon icon={faArrowLeft} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30">
                                <div className="prose prose-slate max-w-none">
                                    <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg">
                                        {selectedNote.content}
                                    </div>
                                </div>
                            </div>

                            {selectedNote.file_url && (
                                <div className="p-4 bg-white border-t border-slate-100 flex justify-center">
                                    <a
                                        href={selectedNote.file_url}
                                        target="_blank"
                                        className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                                    >
                                        <FontAwesomeIcon icon={faDownload} />
                                        Download Full Material
                                    </a>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
