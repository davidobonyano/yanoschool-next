"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faUserCheck, faIdCard, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import Image from 'next/image';

export default function StudentRegister() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hadEmailFromLookup, setHadEmailFromLookup] = useState(false);
  const [classLevel, setClassLevel] = useState('');
  const [stream, setStream] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isExistingStudent, setIsExistingStudent] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [studentNotFound, setStudentNotFound] = useState(false);

  useEffect(() => {
    const lookup = async () => {
      if (!studentId.trim() || studentId.trim().length < 3) {
        setName('');
        setEmail('');
        setHadEmailFromLookup(false);
        setIsExistingStudent(false);
        setStudentNotFound(false);
        return;
      }
      try {
        setIsLookingUp(true);
        const res = await fetch('/api/students/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: studentId.trim().toUpperCase() }),
        });
        const data = await res.json();
        if (data.found) {
          setName(data.student.full_name || '');
          setEmail(data.student.email || '');
          setHadEmailFromLookup(Boolean(data.student.email));
          setClassLevel(data.student.class_level || '');
          setIsExistingStudent(true);
          setAlreadyRegistered(Boolean(data.registered));
          setStudentNotFound(false);
        } else {
          setName('');
          setEmail('');
          setHadEmailFromLookup(false);
          setClassLevel('');
          setIsExistingStudent(false);
          setAlreadyRegistered(false);
          setStudentNotFound(true);
        }
      } catch {
        setIsExistingStudent(false);
        setAlreadyRegistered(false);
        setStudentNotFound(false);
      } finally {
        setIsLookingUp(false);
      }
    };
    lookup();
  }, [studentId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (alreadyRegistered) {
      setMessage('Account already registered. Please login.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentId.trim().toUpperCase(),
          password,
          stream: stream || null,
          classLevel: classLevel || null,
          email: email || null
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Registration failed');
        return;
      }
      setMessage('Password set successfully. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err: any) {
      setMessage(err?.message || 'Registration error');
    }
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
        className="w-full max-w-lg relative z-10"
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account Setup</h1>
          <p className="text-slate-500 mt-2 font-medium">Initialize your student profile</p>
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-12"
        >
          <form onSubmit={handleRegister} className="space-y-6">
            {/* Student ID Lookup Section */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Student ID</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-900 transition-colors">
                  <FontAwesomeIcon icon={faIdCard} />
                </div>
                <input
                  type="text"
                  placeholder="ID-12345"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all duration-200 uppercase font-bold placeholder:font-normal placeholder:text-slate-300"
                  required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isLookingUp && (
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-900 rounded-full animate-spin" />
                  )}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {studentNotFound && !isLookingUp && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs font-bold text-rose-500 ml-1"
                  >
                    No record found for this ID. Please verify.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Revealed Student Data */}
            <AnimatePresence>
              {isExistingStudent && !studentNotFound && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 md:p-6 space-y-3"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-blue-100 flex items-center justify-center text-blue-900 flex-shrink-0 mt-1">
                      <FontAwesomeIcon icon={faUserCheck} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{name}</h4>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">{classLevel} Student</p>
                    </div>
                  </div>

                  {alreadyRegistered && (
                    <div className="pt-2">
                      <p className="text-sm font-bold text-slate-600 bg-white/60 p-3 rounded-lg border border-slate-100 text-center">
                        This account is already active. <Link href="/login" className="text-blue-900 underline ml-1">Log in here</Link>
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Password Creation Section */}
            <AnimatePresence>
              {isExistingStudent && !alreadyRegistered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Create Password</label>
                      <div className="relative group">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all duration-200 font-medium"
                          required
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                          <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Confirm Password</label>
                      <div className="relative group">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all duration-200 font-medium"
                          required
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                          <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full bg-blue-900 text-white py-4 rounded-2xl font-bold shadow-[0_10px_20px_rgba(30,58,138,0.2)] hover:bg-blue-800 transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    Complete Registration
                    <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field if not from lookup */}
            {!hadEmailFromLookup && isExistingStudent && !alreadyRegistered && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Backup Email</label>
                <input
                  type="email"
                  placeholder="For account recovery"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-900 transition-all font-medium"
                />
              </div>
            )}
          </form>

          {/* Status Messaging */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 p-4 rounded-xl text-center text-sm font-bold border ${message.includes('successfully')
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 pt-8 border-t border-slate-100 text-center">
            <p className="text-sm font-medium text-slate-400">
              Already have an account? <Link href="/login" className="text-blue-900 font-bold hover:underline">Sign In</Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
