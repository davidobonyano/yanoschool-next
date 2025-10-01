"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getStudentSession } from "@/lib/student-session";
import { useGlobalAcademicContext } from "@/contexts/GlobalAcademicContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { supabase } from "@/lib/supabase";

import {
  faBook,
  faChartBar,
  faCreditCard,
  faCalendarAlt,
  faExternalLinkAlt,
  faPlay,
  faUser,
} from "@fortawesome/free-solid-svg-icons";

export default function StudentDashboard() {
  const { academicContext } = useGlobalAcademicContext();
  const [isClient, setIsClient] = useState(false);
  const [studentName, setStudentName] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [studentClass, setStudentClass] = useState<string>('');
  const [studentStream, setStudentStream] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  
  type CourseItem = Record<string, unknown>;
  type GradeItem = { total?: number } & Record<string, unknown>;
  type TimetableItem = { course?: string; subject?: string } & Record<string, unknown>;
  type UpcomingExamItem = {
    id: string;
    name: string;
    status: 'Upcoming' | 'Ongoing' | 'Ended';
    date: string;
    time: string;
    duration?: number;
    venue?: string;
    courseName: string;
    sessionCode?: string;
    exam_date?: string;
  };

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallCgpa, setOverallCgpa] = useState<string>('0.00');
  const [paymentStatus, setPaymentStatus] = useState<{
    status: 'PAID' | 'OUTSTANDING' | 'PENDING';
    amount: number;
    displayText: string;
  }>({ status: 'PENDING', amount: 0, displayText: 'PENDING ₦0' });
  const [timetableItems, setTimetableItems] = useState<TimetableItem[]>([]);
  const [currentDay, setCurrentDay] = useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  
  type Announcement = {
    id: string;
    title: string;
    body: string;
    audience: 'students'|'teachers'|'admins'|'all'|'class'|'role';
    created_at: string;
    expires_at: string | null;
    audience_class_level?: string | null;
    audience_stream?: string | null;
    audience_role?: 'student'|'teacher'|'admin' | null;
  };
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // Format class level for display
  const formatClassLevel = (classLevel: string | null | undefined): string => {
    if (!classLevel) return '';
    
    // Handle enum values like JSS1, SS1, PRI1, etc.
    if (classLevel.startsWith('JSS')) {
      return `JSS ${classLevel.slice(3)}`;
    }
    if (classLevel.startsWith('SS')) {
      return `SS ${classLevel.slice(2)}`;
    }
    if (classLevel.startsWith('PRI')) {
      return `Primary ${classLevel.slice(3)}`;
    }
    if (classLevel.startsWith('KG')) {
      return `KG ${classLevel.slice(2)}`;
    }
    
    return classLevel; // Return as-is for any other format
  };

  const formattedClass = formatClassLevel(studentClass);
  const isSenior = studentClass ? studentClass.toUpperCase().startsWith('SS') : false;
  // Use stream from session if available
  const stream = studentStream;



  useEffect(() => {
    setIsClient(true);
    const s = getStudentSession();
    if (s) {
      setStudentName(s.full_name);
      setStudentId(s.student_id);
      setStudentClass(s.class_level || '');
      setStudentStream(s.stream || '');
      setIsActive(typeof s.is_active === 'boolean' ? s.is_active : true);
    }
    // Load profile image
    (async () => {
      try {
        const sid = s?.student_id;
        if (!sid) return;
        type ProfileImageRow = { profile_image_url: string | null };
        const { data, error }: { data: ProfileImageRow | null; error: unknown } = await supabase
          .from('school_students')
          .select('profile_image_url')
          .eq('student_id', sid)
          .maybeSingle();
        if (!error) setProfileImageUrl(data?.profile_image_url ?? null);
      } catch {}
    })();
    
    // Set current day
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    setCurrentDay(dayNames[today.getDay()]);
    
    loadStudentData();
  }, []);

  // Load upcoming exams from the exams portal (Supabase) filtered by class level only
  useEffect(() => {
    const controller = new AbortController();
    const loadUpcoming = async () => {
      try {
        const baseClassLevel = (studentClass || '').trim().split(' ')[0];
        if (!baseClassLevel) {
          setUpcomingExams([]);
          return;
        }
        const nowIso = new Date().toISOString();
        type ExamRow = {
          id: string;
          session_code?: string | null;
          session_name: string;
          class_level: string;
          starts_at: string;
          ends_at: string;
          status: string;
          max_students?: number | null;
          instructions?: string | null;
          exam?: { id: string; title: string; duration_minutes?: number | null } | { id: string; title: string; duration_minutes?: number | null }[] | null;
        };
        const { data, error }: { data: ExamRow[] | null; error: unknown } = await supabase
          .from('exam_sessions')
          .select(`
            id,
            session_code,
            session_name,
            class_level,
            starts_at,
            ends_at,
            status,
            max_students,
            instructions,
            exam:exams ( id, title, duration_minutes )
          `)
          .eq('class_level', baseClassLevel)
          .eq('status', 'active')
          .gte('ends_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(8);
        if (error) {
           
          console.error('Failed to load upcoming exam sessions', error);
          setUpcomingExams([]);
          return;
        }
        const mapped: UpcomingExamItem[] = (data || []).map((s) => {
          const examObj = Array.isArray(s.exam) ? s.exam[0] : s.exam;
          return {
            id: s.id,
            name: s.session_name,
            status: 'Upcoming',
            date: s.starts_at,
            time: new Date(s.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            duration: examObj?.duration_minutes ?? undefined,
            venue: 'TBA',
            courseName: examObj?.title ?? 'Exam',
            sessionCode: s.session_code ?? undefined,
            exam_date: s.starts_at,
          };
        });
        setUpcomingExams(mapped);
      } catch (e) {
         
        console.error('Error loading upcoming exams', e);
        setUpcomingExams([]);
      }
    };
    loadUpcoming();
    return () => controller.abort();
  }, [studentClass]);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with real student courses/grades endpoints once available
      setCourses([]);
      setGrades([]);
      // payments are derived via paymentStatus now
      
    } catch (error) {
      console.error('Error loading student data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Unified fast fetch for cards: courses, CGPA, payments, today's classes
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const loadCards = async () => {
      if (!studentId || !academicContext?.sessionId || !academicContext?.termId) return;
      try {
        // Build requests (endpoints unchanged)
        const regsParams = new URLSearchParams();
        regsParams.append('student_id', studentId);
        if (academicContext?.term) regsParams.append('term', academicContext.term);
        if (academicContext?.session) regsParams.append('session', academicContext.session);
        regsParams.append('status', 'approved');
        regsParams.append('limit', '200');
        const regsReq = fetch(`/api/courses/registrations?${regsParams.toString()}`, { cache: 'no-store', signal })
          .then(r => r.ok ? r.json() : { registrations: [] })
          .catch(() => ({ registrations: [] }));

        const payUrl = new URL('/api/students/payment-history', window.location.origin);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(studentId)) payUrl.searchParams.set('studentId', studentId);
        else payUrl.searchParams.set('studentCode', studentId);
        payUrl.searchParams.set('sessionId', academicContext.sessionId);
        payUrl.searchParams.set('termId', academicContext.termId);
        const payReq = fetch(payUrl.toString(), { cache: 'no-store', signal })
          .then(r => r.ok ? r.json() : { ledger: [] })
          .catch(() => ({ ledger: [] }));

        // Overall CGPA: single summary endpoint
        const resultsReq = fetch(`/api/students/summary?student_id=${encodeURIComponent(studentId)}`, { cache: 'no-store', signal })
          .then(r => r.ok ? r.json() : { overallCgpa: '0.00' })
          .catch(() => ({ overallCgpa: '0.00' }));

        // Timetable for today's classes
        const s = getStudentSession();
        const level = s?.class_level || '';
        const streamVal = s?.stream;
        const normalizedStream = streamVal ? 
          (streamVal.toLowerCase() === 'art' || streamVal.toLowerCase() === 'arts' ? 'Arts' :
           streamVal.toLowerCase() === 'commercial' || streamVal.toLowerCase() === 'commerce' ? 'Commercial' :
           streamVal.toLowerCase() === 'science' || streamVal.toLowerCase() === 'sciences' ? 'Science' : streamVal)
          : null;
        const effectiveClass = level && level.startsWith('SS') && normalizedStream ? `${level} ${normalizedStream}` : level;
        const ttParams = new URLSearchParams({
          action: 'by_student',
          session_id: academicContext.sessionId,
          term_id: academicContext.termId,
        });
        if (effectiveClass) ttParams.set('class', effectiveClass);
        const timetableReq = fetch(`/api/timetables?${ttParams.toString()}`, { cache: 'no-store', signal })
          .then(r => r.ok ? r.json() : { items: [] })
          .catch(() => ({ items: [] }));

        const [regsRes, payRes, resultsRes, ttRes] = await Promise.all([
          regsReq,
          payReq,
          resultsReq,
          timetableReq,
        ]);

        // Courses
        const regs = Array.isArray(regsRes.registrations) ? regsRes.registrations : [];
        setCourses(regs);

        // Payment status
        const ledger = Array.isArray(payRes.ledger) ? payRes.ledger : [];
        if (ledger.length === 0) {
          setPaymentStatus({ status: 'PENDING', amount: 0, displayText: 'PENDING ₦0' });
        } else {
          const totalBalance = ledger.reduce((sum: number, item: { balance?: number }) => sum + Number(item.balance || 0), 0);
          const totalCharged = ledger.reduce((sum: number, item: { total_charged?: number }) => sum + Number(item.total_charged || 0), 0);
          const totalPaid = ledger.reduce((sum: number, item: { total_paid?: number }) => sum + Number(item.total_paid || 0), 0);
          let status: 'PAID' | 'OUTSTANDING' | 'PENDING';
          let displayText: string;
          if (totalPaid >= totalCharged && totalCharged > 0) {
            status = 'PAID';
            displayText = 'PAID';
          } else if (totalPaid > 0 && totalPaid < totalCharged) {
            status = 'OUTSTANDING';
            displayText = `OUTSTANDING ₦${totalBalance.toLocaleString()}`;
          } else {
            status = 'PENDING';
            displayText = `PENDING ₦${totalCharged.toLocaleString()}`;
          }
          setPaymentStatus({ status, amount: totalBalance, displayText });
        }

        // Overall CGPA
        setOverallCgpa(String((resultsRes as any)?.overallCgpa || '0.00'));

        // Timetable
        setTimetableItems(Array.isArray(ttRes.items) ? ttRes.items : []);
      } catch {
        // Fail-soft defaults
        setCourses([]);
        setPaymentStatus({ status: 'PENDING', amount: 0, displayText: 'PENDING ₦0' });
        setOverallCgpa('0.00');
        setTimetableItems([]);
      }
    };

    loadCards();
    return () => controller.abort();
  }, [studentId, academicContext?.sessionId, academicContext?.termId, academicContext?.session, academicContext?.term]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/announcements', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) return;
        const now = Date.now();
        const classMatch = (a: Announcement): boolean => {
          const cls = (studentClass || '').toUpperCase().replace(/\s+/g, '');
          const target = (a.audience_class_level || '').toUpperCase();
          return !!target && cls.includes(target);
        };
        const list: Announcement[] = (data.announcements || [])
          .filter((a: Announcement) => {
            const notExpired = !a.expires_at || new Date(a.expires_at).getTime() > now;
            const forStudents = a.audience === 'all' || a.audience === 'students' || (a.audience === 'role' && a.audience_role === 'student') || (a.audience === 'class' && classMatch(a));
            return notExpired && forStudents;
          })
          .slice(0, 5);
        setAnnouncements(list);
      } catch {}
    })();
  }, []);

  const _calculateGPA = () => {
    if (grades.length === 0) return "0.00";
    const total = grades.reduce((sum: number, grade: GradeItem) => sum + (typeof grade.total === 'number' ? grade.total : 0), 0);
    return ((total / grades.length / 100) * 4).toFixed(1);
  };

  // Safe date formatting to prevent hydration mismatch
  const formatDate = (dateString: string) => {
    if (!isClient) return dateString; // Return raw string on server
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Use the new payment status instead of counting payments
  const _pendingPayments = paymentStatus.displayText;

  const getTodaysClassCount = () => {
    if (!currentDay || currentDay === 'Sunday' || currentDay === 'Saturday') return 0;
    
    const todaysItems = timetableItems.filter(item => 
      item.day === currentDay && 
      item.subject && 
      item.subject.toLowerCase() !== 'break' &&
      item.subject.trim() !== ''
    );
    
    return todaysItems.length;
  };

  // Retain timetable live updates listener
  useEffect(() => {
    const handler = () => {
      // trigger unified loader by toggling state dependencies via noop set
      setTimetableItems(prev => [...prev]);
    };
    window.addEventListener('timetableUpdated', handler as EventListener);
    return () => window.removeEventListener('timetableUpdated', handler as EventListener);
  }, []);


  const hasStudent = Boolean(studentId);
  // Prevent hydration mismatch by showing loading state until client renders
  if (!isClient || loading || !hasStudent) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-2xl mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8 p-6 bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl shadow-xl text-white"
        >
          <div className="flex-shrink-0">
            <div className="h-28 w-28 rounded-lg bg-white/20 border-4 border-white/30 overflow-hidden backdrop-blur-sm">
              {profileImageUrl ? (
                 
                <img src={profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-white/10 flex items-center justify-center text-white text-4xl font-bold">
                  <FontAwesomeIcon icon={faUser} />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <span>Welcome, {studentName || studentId}!</span>
              {!isActive && (
                <span className="px-2 py-1 rounded-md text-xs font-semibold bg-yellow-200 text-yellow-900 border border-yellow-300">
                  Graduated
                </span>
              )}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div>
                <span className="font-medium text-blue-200">Student ID:</span>
                <div className="text-white font-semibold">{studentId}</div>
              </div>
              <div>
                <span className="font-medium text-blue-200">Class:</span>
                <div className="text-white font-semibold">
                  {!isActive ? 'Graduated' : (formattedClass || 'Not Assigned')}
                </div>
              </div>
              <div>
                <span className="font-medium text-blue-200">Status:</span>
                <div className="text-white font-semibold">{isActive ? 'Active' : 'Graduated'}</div>
              </div>
              {(isSenior || !!stream) && (
                <div>
                  <span className="font-medium text-blue-200">Stream:</span>
                  <div className="text-white font-semibold">{stream || '-'}</div>
                </div>
              )}
              <div>
                <span className="font-medium text-blue-200">Session:</span>
                <div className="text-white font-semibold">{academicContext.session || '2025/2026'}</div>
              </div>
              <div>
                <span className="font-medium text-blue-200">Term:</span>
                <div className="text-white font-semibold">{academicContext.term || '1st Term'}</div>
              </div>
            </div>
            

          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            {
              href: "/dashboard/student/courses",
              icon: faBook,
              title: "Current Courses (Approved)",
              value: courses.length,
              color: "blue",
              bgColor: "bg-blue-50",
              iconColor: "text-blue-600",
              valueColor: "text-blue-600",
            },
            {
              href: "/dashboard/student/grades",
              icon: faChartBar,
              title: "Overall CGPA",
              value: overallCgpa,
              color: "green",
              bgColor: "bg-green-50",
              iconColor: "text-green-600",
              valueColor: "text-green-600",
            },
            {
              href: "/dashboard/student/payments",
              icon: faCreditCard,
              title: "Payment Status",
              value: paymentStatus.displayText,
              color: paymentStatus.status === 'PAID' ? 'green' : paymentStatus.status === 'OUTSTANDING' ? 'orange' : 'red',
              bgColor: paymentStatus.status === 'PAID' ? 'bg-green-50' : paymentStatus.status === 'OUTSTANDING' ? 'bg-orange-50' : 'bg-red-50',
              iconColor: paymentStatus.status === 'PAID' ? 'text-green-600' : paymentStatus.status === 'OUTSTANDING' ? 'text-orange-600' : 'text-red-600',
              valueColor: paymentStatus.status === 'PAID' ? 'text-green-600' : paymentStatus.status === 'OUTSTANDING' ? 'text-orange-600' : 'text-red-600',
              status: paymentStatus.status,
              amount: paymentStatus.amount,
            },
            {
              href: "/dashboard/student/timetable",
              icon: faCalendarAlt,
              title: "Today's Classes",
              value: getTodaysClassCount(),
              color: "purple",
              bgColor: "bg-purple-50",
              iconColor: "text-purple-600",
              valueColor: "text-purple-600",
            },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="group"
            >
              <Link
                href={stat.href}
                className={`block p-6 bg-white rounded-2xl shadow-lg border hover:shadow-xl transition-all duration-300 ${stat.bgColor} group-hover:bg-opacity-50`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <FontAwesomeIcon
                      icon={stat.icon}
                      className={`${stat.iconColor} text-2xl`}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-600 text-sm">
                      {stat.title}
                    </h3>
                    <p className={`${stat.title === "Payment Status" ? 'text-lg' : 'text-3xl'} font-bold ${stat.valueColor}`}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Upcoming Exams Section */}
        {upcomingExams.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-white p-6 rounded-2xl shadow-lg border mb-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Upcoming Exams
              </h2>
              <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium">
                {upcomingExams.length} scheduled
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcomingExams.slice(0, 4).map((exam: UpcomingExamItem, index: number) => (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                  className="border border-gray-200 rounded-xl p-5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-gray-800 text-lg">
                      {exam.courseName || exam.name || 'Unknown Course'}
                    </h3>
                    <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                      {exam.status || 'Upcoming'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-2 mb-4">
                    <p className="flex justify-between">
                      <span className="font-medium">Date:</span>
                      <span>{formatDate(exam.date || exam.exam_date || '')}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-medium">Time:</span>
                      <span>{exam.time || 'TBA'}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-medium">Duration:</span>
                      <span>{exam.duration || 'TBA'} minutes</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-medium">Venue:</span>
                      <span>{exam.venue || 'TBA'}</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <motion.a
                      href="https://exam.yanoschools.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-green-700 hover:to-green-800 transition-all duration-300"
                    >
                      <FontAwesomeIcon icon={faPlay} className="text-xs" />
                      Go to Exam Portal
                    </motion.a>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-white p-6 rounded-2xl shadow-lg border mb-8"
          >
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">No Upcoming Exams</h2>
              <p className="text-gray-600 mb-6">You don&apos;t have any exams scheduled at the moment.</p>
              <motion.a
                href="https://exam.yanoschools.com/"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} className="w-4 h-4" />
                Visit Exam Portal
              </motion.a>
            </div>
          </motion.div>
        )}

        {/* Recent Announcements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-white p-6 rounded-2xl shadow-lg border"
        >
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            Recent Announcements
          </h2>
          <div className="space-y-6">
            {announcements.map((a, index) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                className="border-l-4 border-blue-400 pl-4 py-3 bg-blue-50 rounded-r-lg hover:bg-blue-100 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-800">
                    {a.title}
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {formatDate(a.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {a.body}
                </p>
              </motion.div>
            ))}
            {announcements.length === 0 && (
              <div className="text-gray-500">No announcements yet.</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

