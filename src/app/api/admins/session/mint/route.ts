import { NextResponse } from 'next/server';
import { setAdminSessionCookie } from '@/lib/admin-session';
import { supabaseService } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const authz = request.headers.get('authorization') || '';
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 400 });
    }

    const { data, error } = await supabaseService.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const user = data.user;
    const role = user.user_metadata?.role;
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Not an admin account' }, { status: 403 });
    }

    // Mint your legacy admin session cookie for compatibility
    const email = user.email || '';
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name = typeof meta?.name === 'string' ? meta.name : undefined;
    const adminId = (typeof meta?.admin_id === 'string' ? meta.admin_id : undefined) || user.id;
    const tokenCookie = await (await import('@/lib/admin-session')).createAdminSessionToken({ adminId, email, name });
    await setAdminSessionCookie(tokenCookie);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}







