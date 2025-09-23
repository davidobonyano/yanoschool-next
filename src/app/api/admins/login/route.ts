import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseService } from '@/lib/supabase-server';
import { createAdminSessionToken, setAdminSessionCookie } from '@/lib/admin-session';

export async function POST(request: Request) {
	try {
		const { email, password } = await request.json();
		if (!email || !password) {
			return NextResponse.json({ error: 'email and password required' }, { status: 400 });
		}

		// Authenticate with Supabase Auth
		const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
		if (signInError) {
			return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const user = data.user;
		const meta = user?.user_metadata as Record<string, unknown> | undefined;
		const role = typeof meta?.role === 'string' ? meta.role : '';
		if (role !== 'admin') {
			return NextResponse.json({ error: 'Not an admin account' }, { status: 403 });
		}

		// Ensure an admin record exists/up-to-date
		const name = typeof meta?.name === 'string' ? meta.name : null;
		const adminId = user?.id as string;
		if (adminId) {
			await supabaseService
				.from('admins')
				.upsert({ id: adminId, name, email, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'id' })
				.select('id, name, email')
				.maybeSingle();
		}

		// Issue existing admin session cookie
		const token = await createAdminSessionToken({ adminId, email, name: name || undefined });
		await setAdminSessionCookie(token);

		return NextResponse.json({ success: true, admin: { id: adminId, name, email } });
	} catch (err: unknown) {
		const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Unexpected error';
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
