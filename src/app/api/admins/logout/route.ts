import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/admin-session';

export async function POST() {
  try {
    await clearAdminSessionCookie();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
