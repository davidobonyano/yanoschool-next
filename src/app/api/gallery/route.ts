import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    let query = supabase
      .from('gallery_images')
      .select('id, image_url, alt, title, category, description, display_order')
      .order('display_order', { ascending: true });
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ images: data ?? [] });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Failed to fetch gallery';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}






