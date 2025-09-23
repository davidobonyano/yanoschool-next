import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CourseRegistrationUpdate } from '@/types/courses';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params;
    const body: CourseRegistrationUpdate = await request.json();

    // Validate required fields
    if (!body.status || !['pending', 'approved', 'rejected'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, approved, or rejected.' },
        { status: 400 }
      );
    }

    // Update the registration
    // Build safe update payload
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    type UpdatePayload = {
      status: 'pending' | 'approved' | 'rejected';
      updated_at: string;
      approved_at?: string;
      approved_by?: string;
      rejection_reason?: string | null;
    };
    const updatePayload: UpdatePayload = {
      status: body.status,
      updated_at: new Date().toISOString()
    };
    if (body.status === 'approved') {
      updatePayload.approved_at = body.approved_at || new Date().toISOString();
      if (body.approved_by && uuidRegex.test(body.approved_by)) {
        updatePayload.approved_by = body.approved_by;
      }
    }
    if (body.status === 'rejected') {
      updatePayload.rejection_reason = body.rejection_reason || null;
    }

    const { data, error } = await supabase
      .from('student_course_registrations')
      .update(updatePayload)
      .eq('id', registrationId)
      .select(`
        *,
        school_students!inner(full_name),
        courses!inner(name, code)
      `)
      .single();

    if (error) {
      console.error('Error updating registration:', error);
      return NextResponse.json(
        { error: 'Failed to update registration' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Transform the data to match the expected format
    const transformedData = {
      ...data,
      student_name: (data as { school_students?: { full_name?: string } }).school_students?.full_name,
      course_name: (data as { courses?: { name?: string } }).courses?.name,
      course_code: (data as { courses?: { code?: string } }).courses?.code
    };

    return NextResponse.json({
      message: 'Registration updated successfully',
      registration: transformedData
    });

  } catch (error) {
    console.error('Error in PUT /api/courses/registrations/[registrationId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params;

    // Delete the registration
    const { error } = await supabase
      .from('student_course_registrations')
      .delete()
      .eq('id', registrationId);

    if (error) {
      console.error('Error deleting registration:', error);
      return NextResponse.json(
        { error: 'Failed to delete registration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Registration deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/courses/registrations/[registrationId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}










