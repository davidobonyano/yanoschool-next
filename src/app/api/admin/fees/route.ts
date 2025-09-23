import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readAdminSession } from '@/lib/admin-session';

// GET: list fees for class/session/term
export async function GET(request: Request) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const termId = searchParams.get('termId');
  const classLevel = searchParams.get('classLevel');
  const stream = searchParams.get('stream');

  let query = supabase.from('fee_structures').select('*');
  if (sessionId) query = query.eq('session_id', sessionId);
  if (termId) query = query.eq('term_id', termId);
  if (classLevel) query = query.eq('class_level', classLevel);
  if (stream === null) {
    // no filter on stream
  } else if (stream === 'null') {
    query = query.is('stream', null);
  } else if (stream) {
    query = query.eq('stream', stream);
  }

  const { data, error } = await query.order('class_level', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// POST: upsert a fee for class/session/term/purpose
export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { classLevel, sessionId, termId, purpose, amount, isActive, stream } = body || {};
  if (!classLevel || !sessionId || !termId || !purpose || typeof amount !== 'number') {
    return NextResponse.json({ error: 'classLevel, sessionId, termId, purpose, amount required' }, { status: 400 });
  }
  // Normalize stream: treat empty string as null so upsert conflicts with NULL-stream rows
  const normalizedStream = (stream === null || stream === undefined || String(stream).trim() === '') ? null : stream;

  // Workaround for NULL stream uniqueness: try update-if-exists, else insert
  // 1) Find existing row by class/session/term/purpose and stream (handling NULL)
  let finder = supabaseAdmin
    .from('fee_structures')
    .select('id')
    .eq('class_level', classLevel)
    .eq('session_id', sessionId)
    .eq('term_id', termId)
    .eq('purpose', purpose)
    .limit(1);
  if (normalizedStream === null) {
    finder = finder.is('stream', null);
  } else {
    finder = finder.eq('stream', normalizedStream);
  }
  const { data: existing, error: findErr } = await finder.maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message, stage: 'find' }, { status: 500 });

  if (existing?.id) {
    // 2) Update existing by id
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('fee_structures')
      .update({ amount, is_active: isActive ?? true })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (updErr) return NextResponse.json({ error: updErr.message, stage: 'update' }, { status: 500 });
    return NextResponse.json({ item: updated });
  } else {
    // 3) Insert new
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('fee_structures')
      .insert({ class_level: classLevel, stream: normalizedStream, session_id: sessionId, term_id: termId, purpose, amount, is_active: isActive ?? true })
      .select('*')
      .maybeSingle();
    if (insErr) return NextResponse.json({ error: insErr.message, stage: 'insert' }, { status: 500 });
    return NextResponse.json({ item: inserted });
  }
}

// DELETE: delete a specific fee
export async function DELETE(request: Request) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const classLevel = searchParams.get('classLevel');
  const sessionId = searchParams.get('sessionId');
  const termId = searchParams.get('termId');
  const purpose = searchParams.get('purpose');
  const stream = searchParams.get('stream');
  const confirm = searchParams.get('confirm') === 'true';
  if (!classLevel || !sessionId || !termId || !purpose) {
    return NextResponse.json({ error: 'classLevel, sessionId, termId, purpose required' }, { status: 400 });
  }
  const filter: { class_level: string; session_id: string; term_id: string; purpose: string; stream?: string | null } = {
    class_level: classLevel,
    session_id: sessionId,
    term_id: termId,
    purpose
  };
  
  // Handle stream filtering properly
  if (stream === 'null') {
    // Use is() for null values in Supabase
    filter.stream = null;
  } else if (stream && stream !== 'undefined' && stream !== 'null') {
    filter.stream = stream;
  }
  // If stream is undefined or empty, don't include it in the filter

  // Build query manually to handle null stream properly
  let query = supabaseAdmin
    .from('fee_structures')
    .select('id, class_level, stream, session_id, term_id, purpose, amount, is_active')
    .eq('class_level', classLevel)
    .eq('session_id', sessionId)
    .eq('term_id', termId)
    .eq('purpose', purpose);

  // Handle stream filtering properly
  if (stream === 'null') {
    query = query.is('stream', null);
  } else if (stream && stream !== 'undefined' && stream !== 'null') {
    query = query.eq('stream', stream);
  }

  // If not confirmed, show what would be deleted for client-side confirmation UX
  if (!confirm) {
    const { data: matches, error: findError } = await query;
    if (findError) return NextResponse.json({ error: findError.message, stage: 'preview' }, { status: 500 });
    return NextResponse.json({ confirmRequired: true, matches: matches || [] });
  }

  // For deletion, we need to get the IDs first, then delete by ID
  const { data: toDelete, error: findError } = await query;
  if (findError) return NextResponse.json({ error: findError.message, stage: 'find' }, { status: 500 });
  
  if (!toDelete || toDelete.length === 0) {
    return NextResponse.json({ success: false, message: 'No matching fee structure found to delete' }, { status: 404 });
  }

  // Delete by IDs - filter out any undefined IDs
  const validIds = toDelete.map(item => item.id).filter((id): id is string => Boolean(id) && id !== 'undefined');
  
  if (validIds.length === 0) {
    return NextResponse.json({ success: false, message: 'No valid IDs found for deletion' }, { status: 400 });
  }
  
  const { data: _deleted, error } = await supabaseAdmin
    .from('fee_structures')
    .delete()
    .in('id', validIds);
    
  if (error) return NextResponse.json({ error: error.message, stage: 'delete' }, { status: 500 });
  return NextResponse.json({ success: true, deletedCount: validIds.length, deleted: toDelete });
}


