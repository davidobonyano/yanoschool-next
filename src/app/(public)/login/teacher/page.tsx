'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash, faChalkboardTeacher } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import Image from 'next/image';

export default function TeacherLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/teachers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Login failed');
      } else {
        // Session is now handled by server-side cookies
        setMessage(`Welcome back, ${data.teacher.full_name}!`);
        setTimeout(() => {
          router.push('/dashboard/teacher');
        }, 800);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : undefined;
      setMessage(msg || 'Login error');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 relative overflow-hidden text-[#1A1A1A]">
      {/* Decorative Blur Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/40 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[120px]" />

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Faculty Portal</h1>
          <p className="text-slate-500 mt-2 font-medium">Educator Dashboard Access</p>
        </div>

        {/* Login Form Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-10"
        >
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>
                <input
                  type="email"
                  placeholder="name@yanoschools.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 outline-none transition-all duration-200 font-medium placeholder:text-slate-300 placeholder:font-normal"
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
                  href="/login/teacher/forgot-password"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <FontAwesomeIcon icon={faLock} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 outline-none transition-all duration-200 font-medium placeholder:text-slate-300"
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
              className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-[0_10px_20px_rgba(5,150,105,0.2)] hover:bg-emerald-700 hover:shadow-[0_15px_25px_rgba(5,150,105,0.3)] disabled:bg-slate-400 disabled:shadow-none transition-all duration-300 mt-2"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                  Authenticating...
                </div>
              ) : (
                'Sign In to Faculty'
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
                href="/login"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200"
              >
                Student
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
          Administrator issues? <Link href="/contact" className="text-slate-600 border-b border-slate-300 hover:border-slate-600 pb-0.5 transition-all">Support Desk</Link>
        </p>
      </motion.div>
    </div>
  );
}
