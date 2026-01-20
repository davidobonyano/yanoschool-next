'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import Image from 'next/image';
import { setStudentSession } from '@/lib/student-session';

export default function StudentLogin() {
  const router = useRouter();
  const [studentIdOrEmail, setStudentIdOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/students/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentIdOrEmail.trim().toUpperCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Login failed');
      } else {
        setMessage(`Welcome back, ${data.student.full_name}!`);
        // Save session and enrich with class/stream from lookup
        const baseSession = {
          student_id: data.student.student_id,
          full_name: data.student.full_name,
        } as const;
        try {
          const lookupRes = await fetch('/api/students/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: data.student.student_id })
          });
          if (lookupRes.ok) {
            const lookup = await lookupRes.json();
            if (lookup?.found) {
              const sessionData = {
                ...baseSession,
                class_level: lookup.student?.class_level || undefined,
                stream: lookup.student?.stream || undefined,
                is_active: typeof lookup.student?.is_active === 'boolean' ? lookup.student.is_active : undefined,
              };
              setStudentSession(sessionData);
            } else {
              setStudentSession(baseSession);
            }
          } else {
            setStudentSession(baseSession);
          }
        } catch {
          setStudentSession(baseSession);
        }
        setTimeout(() => {
          router.push('/dashboard/student');
        }, 800);
      }
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Login error';
      setMessage(message);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 relative overflow-hidden text-[#1A1A1A]">
      {/* Decorative Blur Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-200/50 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo/Identity */}
        <div className="flex flex-col items-center mb-10">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 group hover:shadow-md transition-shadow duration-300">
            <Link href="/">
              <Image
                src="/images/yano-logo.png"
                alt="Yano School Logo"
                width={140}
                height={56}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Student Portal</h1>
          <p className="text-slate-500 mt-2 font-medium">Please enter your credentials to continue</p>
        </div>

        {/* Login Form Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-10"
        >
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Student ID Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Student ID
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-900 transition-colors">
                  <FontAwesomeIcon icon={faUser} />
                </div>
                <input
                  type="text"
                  placeholder="ID-12345"
                  value={studentIdOrEmail}
                  onChange={(e) => setStudentIdOrEmail(e.target.value.toUpperCase())}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all duration-200 uppercase font-medium placeholder:text-slate-300 placeholder:font-normal"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  href="/login/forgot-password"
                  className="text-xs font-semibold text-blue-900 hover:text-blue-700 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-900 transition-colors">
                  <FontAwesomeIcon icon={faLock} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all duration-200 font-medium placeholder:text-slate-300"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            {/* Login Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              className="w-full bg-blue-900 text-white py-4 rounded-xl font-bold shadow-[0_10px_20px_rgba(30,58,138,0.2)] hover:bg-blue-800 hover:shadow-[0_15px_25px_rgba(30,58,138,0.3)] disabled:bg-slate-400 disabled:shadow-none transition-all duration-300 mt-2"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                  Verifying...
                </div>
              ) : (
                'Sign In to Dashboard'
              )}
            </motion.button>
          </form>

          {/* Alternative Portals */}
          <div className="mt-10">
            <div className="relative flex items-center mb-8">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Other Porters</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/login/teacher"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200"
              >
                Teacher
              </Link>
              <Link
                href="/login/admin"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200"
              >
                Administrator
              </Link>
            </div>
          </div>

          {/* Status Message */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className={`overflow-hidden`}
              >
                <div className={`p-4 rounded-xl text-center text-sm font-bold border ${message.includes('Welcome')
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                  {message}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Support Link */}
        <p className="text-center mt-8 text-sm font-medium text-slate-400">
          Need help? <Link href="/contact" className="text-blue-900 border-b border-blue-900/30 hover:border-blue-900 pb-0.5 transition-all">Contact School Support</Link>
        </p>
      </motion.div>
    </div>
  );
}