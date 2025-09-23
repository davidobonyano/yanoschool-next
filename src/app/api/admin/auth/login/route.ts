import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });

    // Optional: ensure role is admin
    const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
    const role = typeof meta?.role === 'string' ? meta.role : '';
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Not an admin account' }, { status: 403 });
    }

    return NextResponse.json({ user: data.user, session: data.session });
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}







