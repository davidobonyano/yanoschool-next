'use client';

import { useState, useEffect } from 'react';
import { getStudentSession } from '@/lib/student-session';
import { useGlobalAcademicContext } from '@/contexts/GlobalAcademicContext';
import { useRouter } from 'next/navigation';

function gradeToPoint(grade: string): number {
  if (!grade) return 0;
  if (grade.startsWith('A')) return 5.0;
  if (grade === 'B2') return 4.5;
  if (grade === 'B3') return 4.0;
  if (grade === 'C4') return 3.5;
  if (grade === 'C5') return 3.0;
  if (grade === 'C6') return 2.5;
  if (grade === 'D7') return 2.0;
  if (grade === 'E8') return 1.0;
  return 0.0;
}

export default function StudentGrades() {
  const router = useRouter();
  const { academicContext } = useGlobalAcademicContext();
  const [mounted, setMounted] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('First Term');
  const [selectedSession, setSelectedSession] = useState('');
  const [studentName, setStudentName] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [studentClassLevel, setStudentClassLevel] = useState<string>('');
  const [studentStream, setStudentStream] = useState<string | undefined>(undefined);
  const [grades, setGrades] = useState<any[]>([]);
  const [gpa, setGpa] = useState<string>('0.00');
  const [position, setPosition] = useState<string>('N/A');
  const [overallCgpa, setOverallCgpa] = useState<string>('0.00');
  const [allSessions, setAllSessions] = useState<Array<{ name: string }>>([]);

  useEffect(() => {
    setMounted(true);
    const s = getStudentSession();
    setStudentName(s?.full_name || '');
    setStudentId(s?.student_id || '');
    setStudentClassLevel(s?.class_level || '');
    setStudentStream(s?.stream || undefined);
    
    // Fetch all available sessions
    const fetchSessions = async () => {
      try {
        const sessResp = await fetch('/api/settings/academic-context?action=sessions');
        const sessJson = await sessResp.json();
        const sessions: Array<{ name: string }> = sessJson.sessions || [];
        setAllSessions(sessions);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    const fetchGrades = async () => {
      const s = getStudentSession();
      if (!s?.student_id || !selectedSession || !selectedTerm) return;
      const [res, rankRes] = await Promise.all([
        fetch(`/api/results?student_id=${encodeURIComponent(s.student_id)}&session=${encodeURIComponent(selectedSession)}&term=${encodeURIComponent(selectedTerm)}`),
        studentClassLevel
          ? fetch(`/api/reports/results?class_level=${encodeURIComponent(studentClassLevel)}&stream=${encodeURIComponent(studentStream || 'null')}&term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}`)
          : Promise.resolve(null as any)
      ]);

      const json = res ? await res.json() : { results: [] };
      const results = (json?.results || []).map((r: any) => ({
        id: r.id,
        courseName: r.courseName,
        assignment: r.ca,
        test: r.midterm,
        exam: r.exam,
        total: r.total,
        grade: r.grade,
      }));
      setGrades(results);

      // GPA for selected term
      if (results.length > 0) {
        const pts = results.map((r: { grade: string }) => gradeToPoint(r.grade));
        const g = pts.reduce((a: number, b: number) => a + b, 0) / pts.length;
        setGpa(g.toFixed(2));
      } else {
        setGpa('0.00');
      }

      // Position via report endpoint
      if (rankRes && rankRes.ok) {
        const rj = await rankRes.json();
        const me = (rj.rankings || []).find((x: any) => x.studentId === s.student_id);
        setPosition(me ? String(me.rank) : 'N/A');
      } else if (studentClassLevel) {
        setPosition('N/A');
      }
    };
    fetchGrades();
  }, [selectedTerm, selectedSession, studentClassLevel, studentStream]);

  // Remove session CGPA; we'll only show overall CGPA

  // Overall CGPA across all sessions (fetch sessions list, then compute)
  useEffect(() => {
    const fetchOverallCgpa = async () => {
      const s = getStudentSession();
      if (!s?.student_id) return setOverallCgpa('0.00');
      try {
        const sumResp = await fetch(`/api/students/summary?student_id=${encodeURIComponent(s.student_id)}`);
        if (!sumResp.ok) return setOverallCgpa('0.00');
        const sj = await sumResp.json();
        setOverallCgpa(String(sj.overallCgpa || '0.00'));
      } catch {
        setOverallCgpa('0.00');
      }
    };
    fetchOverallCgpa();
  }, []);

  // Sync selected session with global academic context
  useEffect(() => {
    if (academicContext.session) {
      setSelectedSession(academicContext.session);
    }
  }, [academicContext.session]);

  // Sync selected term with global academic context (map 1st/2nd/3rd -> First/Second/Third Term)
  useEffect(() => {
    const term = (academicContext.term || '').toLowerCase();
    if (!term) return;
    if (term.startsWith('1') || term.startsWith('1st') || term.startsWith('first')) {
      setSelectedTerm('First Term');
      return;
    }
    if (term.startsWith('2') || term.startsWith('2nd') || term.startsWith('second')) {
      setSelectedTerm('Second Term');
      return;
    }
    if (term.startsWith('3') || term.startsWith('3rd') || term.startsWith('third')) {
      setSelectedTerm('Third Term');
      return;
    }
  }, [academicContext.term]);
  
  const getGradeColor = (grade: string) => {
    if (grade?.startsWith('A')) return 'bg-green-100 text-green-800';
    if (grade === 'B2') return 'bg-blue-100 text-blue-800';
    if (grade === 'B3') return 'bg-blue-100 text-blue-800';
    if (grade?.startsWith('C')) return 'bg-yellow-100 text-yellow-800';
    if (grade === 'D7') return 'bg-orange-100 text-orange-800';
    if (grade === 'E8') return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const calculateGPA = () => gpa;
  const getOverallPosition = () => position;

  if (!mounted) return null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Results</h1>
        <span className="text-sm text-gray-500">Student: {studentName || studentId}</span>
      </div>

      {/* Term and Session Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
            <select 
              value={selectedTerm} 
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="First Term">First Term</option>
              <option value="Second Term">Second Term</option>
              <option value="Third Term">Third Term</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
            <select 
              value={selectedSession} 
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              {allSessions.map(session => (
                <option key={session.name} value={session.name}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              onClick={() => router.push('/dashboard/student/results')}
            >
              View Full Results
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-700">Term GPA</h3>
          <p className="text-2xl font-bold text-blue-600">{calculateGPA()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-700">Class Position</h3>
          <p className="text-2xl font-bold text-purple-600">{getOverallPosition()}</p>
        </div>
      </div>

      {/* Overall CGPA across all sessions */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <h3 className="text-sm font-medium text-gray-700">Overall CGPA (All Sessions)</h3>
        <p className="text-2xl font-bold text-indigo-600">{overallCgpa}</p>
      </div>

      {/* How we calculate */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6 text-sm text-gray-700">
        <h3 className="font-semibold mb-2">How your GPA / CGPA and Position are calculated</h3>
        <ul className="list-disc ml-5 space-y-1">
          <li>
            <span className="font-medium">Grade points</span>: We convert each subject grade to points: A1=5.0, B2=4.5, B3=4.0, C4=3.5, C5=3.0, C6=2.5, D7=2.0, E8=1.0, F9=0.0.
          </li>
          <li>
            <span className="font-medium">Term GPA</span>: Total grade points added for the term ÷ total number of subjects for that term.
          </li>
          <li>
            <span className="font-medium">Overall CGPA (All Sessions)</span>: Add all grade points across every session and term you have taken ÷ total number of subjects across all sessions.
          </li>
          <li>
            <span className="font-medium">Class Position</span>: We sum your subject totals (0–100) and rank everyone in your class/stream for the selected term (highest aggregate = 1st). Ties share the same rank.
          </li>
        </ul>
      </div>
      
      {/* Results Table */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-lg font-semibold mb-4">{selectedTerm} - {selectedSession} Results</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold">Subject</th>
                <th className="text-center py-3 px-4 font-semibold">CA (20)</th>
                <th className="text-center py-3 px-4 font-semibold">Midterm (20)</th>
                <th className="text-center py-3 px-4 font-semibold">Exam (60)</th>
                <th className="text-center py-3 px-4 font-semibold">Total (100)</th>
                <th className="text-center py-3 px-4 font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade) => (
                <tr key={grade.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{grade.courseName}</td>
                  <td className="py-3 px-4 text-center">{grade.assignment || '-'}</td>
                  <td className="py-3 px-4 text-center">{grade.test || '-'}</td>
                  <td className="py-3 px-4 text-center">{grade.exam || '-'}</td>
                  <td className="py-3 px-4 text-center font-semibold">{grade.total}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${getGradeColor(grade.grade)}`}>
                      {grade.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {grades.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No results available for {selectedTerm} - {selectedSession}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
