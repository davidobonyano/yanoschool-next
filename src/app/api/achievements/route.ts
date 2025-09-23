import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('id, event_date, title, description, display_order')
      .order('display_order', { ascending: true })
      .order('event_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ achievements: data ?? [] });
  } catch (e: unknown) {
    const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Failed to fetch achievements';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}






