import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define the expected shape of a registration row returned by the RPC
type RegistrationRow = {
  student_id: string;
  student_name: string;
  class_level: string;
  stream: string | null;
  course_code: string;
  course_name: string;
  session: string;
  term: string;
  status: string;
  registered_at: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get('session');
    const term = searchParams.get('term');
    const classLevel = searchParams.get('class_level');

    // Call the SQL RPC with correct parameter names and types
    const { data, error } = await supabase.rpc('list_course_registrations', {
      p_session: session,
      p_term: term,
      // Cast to the enum-typed parameter without using 'any'
      p_class_level: classLevel as unknown as string,
      p_stream: null,
      p_status: null
    });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
    }

    const rows = (data ?? []) as RegistrationRow[];

    // Transform data to match expected format
    const registrations = rows.map((reg: RegistrationRow) => ({
      student_id: reg.student_id,
      student_name: reg.student_name,
      class_level: reg.class_level,
      stream: reg.stream || '',
      course_code: reg.course_code,
      course_name: reg.course_name,
      session: reg.session,
      term: reg.term,
      status: reg.status,
      registered_at: reg.registered_at
    }));

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
