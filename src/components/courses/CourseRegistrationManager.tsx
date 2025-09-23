'use client';

import { useState, useEffect } from 'react';
import { 
  StudentCourseRegistration, 
  CourseRegistrationFilters 
} from '@/types/courses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Filter } from 'lucide-react';
import { CourseRegistrationForm } from './CourseRegistrationForm';
import { RegistrationTable } from './RegistrationTable';
import { useAcademicContext } from '@/lib/academic-context';
import { CLASS_LEVELS } from '@/types/courses';
import { useNotifications } from '@/components/ui/notifications';

interface CourseRegistrationManagerProps {
  userRole: 'admin' | 'teacher' | 'student';
  userId?: string;
  userClassLevel?: string;
  userStream?: string;
  className?: string;
}

export function CourseRegistrationManager({ 
  userRole, 
  userId, 
  userClassLevel, 
  userStream, 
  className = '' 
}: CourseRegistrationManagerProps) {
  const { currentContext, sessions } = useAcademicContext();
  const { showErrorToast, showSuccessToast, showConfirmation, hideConfirmation, setConfirmationLoading, ConfirmationModal } = useNotifications();
  const [registrations, setRegistrations] = useState<StudentCourseRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [filters, setFilters] = useState<CourseRegistrationFilters>({
    status: undefined,
    class_level: 'all',
    term: 'all',
    session: 'all'
  });

  const canManageRegistrations = userRole === 'admin' || userRole === 'teacher';
  const canCreateRegistrations = userRole === 'student';

  // Fetch registrations based on user role and filters
  const fetchRegistrations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add user-specific filters
      if (userRole === 'student' && userId) {
        params.append('student_id', userId);
      }
      
      // For current term/session focus: add current academic context by default
      // For students, always filter to current term/session unless filters override
      if (userRole === 'student') {
        const sessionToUse = filters.session !== 'all' ? filters.session : currentContext?.session_name;
        const termToUse = filters.term !== 'all' ? filters.term : currentContext?.term_name;
        
        // For students, we MUST have both session and term - don't show anything if context is missing
        if (!sessionToUse || !termToUse) {
          setRegistrations([]);
          return;
        }
        
        params.append('session', sessionToUse);
        params.append('term', termToUse);
      } else {
        // For admin/teacher, allow broader filtering
        const currentSession = filters.session === 'all' ? currentContext?.session_name : filters.session;
        const currentTerm = filters.term === 'all' ? currentContext?.term_name : filters.term;
        
        if (currentSession && currentSession !== 'all') {
          params.append('session', currentSession);
        }
        if (currentTerm && currentTerm !== 'all') {
          params.append('term', currentTerm);
        }
      }
      
      // Add other filters (excluding session/term since we handle them above)
      Object.entries(filters).forEach(([key, value]) => {
        if (key !== 'session' && key !== 'term' && value && value !== 'all') {
          params.append(key, value);
        }
      });

      const response = await fetch(`/api/courses/registrations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch registrations');
      
      const data = await response.json();
      
      // Debug logging for students to see what's being fetched
      if (userRole === 'student') {
        console.log('Student course registrations API call:', `/api/courses/registrations?${params}`);
        console.log('Current academic context:', currentContext);
        console.log('Fetched registrations:', data.registrations);
      }
      
      setRegistrations(data.registrations || []);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      console.error('Failed to load registrations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [userRole, userId, filters, currentContext]);

  const handleRegistrationSuccess = () => {
    fetchRegistrations();
  };

  const handleFilterChange = (key: keyof CourseRegistrationFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: undefined,
      class_level: 'all',
      term: 'all',
      session: 'all'
    });
  };

  // No local status badge renderer needed; the table handles display

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Course Registrations</h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'admin' && 'Manage all student course registrations'}
            {userRole === 'teacher' && 'Review and approve student course registrations'}
            {userRole === 'student' && 'Your course registration history'}
          </p>
          {userRole === 'student' && currentContext && (
            <p className="text-sm text-blue-600 font-medium mt-1">
              Current Term: {currentContext.session_name} • {currentContext.term_name}
            </p>
          )}
        </div>
        {canManageRegistrations && currentContext && (
          <Button
            variant="destructive"
            onClick={async () => {
              showConfirmation(
                'Reset Registrations',
                `Reset all registrations for ${currentContext.term_name} • ${currentContext.session_name}?`,
                async () => {
                  try {
                    setConfirmationLoading(true);
                    const resp = await fetch('/api/courses/registrations/reset', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ term: currentContext.term_name, session: currentContext.session_name })
                    });
                    if (!resp.ok) {
                      const data = await resp.json().catch(() => ({}));
                      throw new Error(data.error || 'Failed to reset');
                    }
                    showSuccessToast('Registrations reset successfully');
                    hideConfirmation();
                    fetchRegistrations();
                  } catch (e) {
                    console.error(e);
                    showErrorToast(e instanceof Error ? e.message : 'Failed to reset registrations');
                  } finally {
                    setConfirmationLoading(false);
                  }
                },
                { confirmText: 'Reset', type: 'danger' }
              );
            }}
          >
            Reset Current Term Registrations
          </Button>
        )}

        {canCreateRegistrations && (
          <Button onClick={() => setShowRegistrationForm(true)} className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Register for Course
          </Button>
        )}
      </div>

      {/* Filters - Only for Admin/Teacher, not for students */}
      {canManageRegistrations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                                      <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class-filter">Class Level</Label>
                <Select value={filters.class_level} onValueChange={(value) => handleFilterChange('class_level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                                      <SelectItem value="all">All classes</SelectItem>
                  {CLASS_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="term-filter">Term</Label>
                <Select value={filters.term} onValueChange={(value) => handleFilterChange('term', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All terms" />
                  </SelectTrigger>
                  <SelectContent>
                                      <SelectItem value="all">All terms</SelectItem>
                  <SelectItem value="1st Term">1st Term</SelectItem>
                  <SelectItem value="2nd Term">2nd Term</SelectItem>
                  <SelectItem value="3rd Term">3rd Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-filter">Session</Label>
                <Select value={filters.session} onValueChange={(value) => handleFilterChange('session', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sessions</SelectItem>
                    {(sessions || [])
                      .slice()
                      .sort((a, b) => String(b.name).localeCompare(String(a.name)))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <ConfirmationModal />

      {/* Registration Table */}
      <RegistrationTable
        registrations={registrations}
        userRole={userRole}
        onRefresh={fetchRegistrations}
        isLoading={isLoading}
      />

      {/* Registration Form Dialog */}
      {canCreateRegistrations && userClassLevel && (
        <CourseRegistrationForm
          isOpen={showRegistrationForm}
          onClose={() => setShowRegistrationForm(false)}
          onSuccess={handleRegistrationSuccess}
          userClassLevel={userClassLevel}
          userStream={userStream}
          studentId={userId}
        />
      )}
    </div>
  );
}
