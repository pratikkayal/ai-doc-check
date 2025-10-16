import { NextResponse } from 'next/server';
import { defaultChecklist } from '@/lib/checklist-data';
import { isAuthenticated } from '@/lib/session';

export async function GET() {
  try {
    // Check if user is authenticated
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: defaultChecklist,
    });
  } catch (error) {
    console.error('Checklist fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch checklist' },
      { status: 500 }
    );
  }
}

