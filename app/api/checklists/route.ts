import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
import { listChecklists, saveChecklist } from '@/lib/checklists';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const list = await listChecklists();
    return NextResponse.json({ success: true, data: list });
  } catch (e) {
    console.error('checklists GET error', e);
    return NextResponse.json({ success: false, error: 'Failed to list checklists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, items } = (body || {}) as { name?: string; description?: string; items?: Array<{ id: number; description: string; criteria: string }>; };
    if (!name || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Invalid checklist payload' }, { status: 400 });
    }

    const saved = await saveChecklist({ name, description: description || '', items });
    return NextResponse.json({ success: true, data: saved });
  } catch (e) {
    console.error('checklists POST error', e);
    return NextResponse.json({ success: false, error: 'Failed to save checklist' }, { status: 500 });
  }
}

