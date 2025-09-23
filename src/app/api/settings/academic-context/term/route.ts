import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase-server';

export async function PUT(request: NextRequest) {
  try {
    const { term } = await request.json();
    const supabase = supabaseService;

    if (!term) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    // Get the term ID
    const { data: termData, error: termError } = await supabase
      .from('academic_terms')
      .select('id, name')
      .eq('name', term)
      .single();

    if (termError || !termData) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }

    // Find existing current academic context row (singleton)
    const { data: existingContext, error: existingError } = await supabase
      .from('current_academic_context')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('Error reading academic context:', existingError);
      return NextResponse.json({ error: 'Failed to read academic context' }, { status: 500 });
    }

    let _contextData;
    let contextError;

    if (existingContext?.id) {
      // Update the existing row by id (required filter for updates)
      ({ data: _contextData, error: contextError } = await supabase
        .from('current_academic_context')
        .update({ 
          term_id: termData.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingContext.id)
        .select(`
          *,
          academic_sessions!inner(name as session_name),
          academic_terms!inner(name as term_name)
        `)
        .single());
    } else {
      // Insert a new context row if none exists
      ({ data: _contextData, error: contextError } = await supabase
        .from('current_academic_context')
        .insert({ 
          term_id: termData.id,
          updated_at: new Date().toISOString()
        })
        .select(`
          *,
          academic_sessions!inner(name as session_name),
          academic_terms!inner(name as term_name)
        `)
        .single());
    }

    if (contextError) {
      console.error('Error updating academic context:', contextError);
      return NextResponse.json({ error: 'Failed to update academic context' }, { status: 500 });
    }

    return NextResponse.json({
      term_id: termData.id,
      term_name: termData.name,
      message: 'Term updated successfully'
    });
  } catch (error) {
    console.error('Error in term update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
