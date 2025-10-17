import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
import { loadChecklist, saveChecklist } from '@/lib/checklists';

export async function GET(request: NextRequest, context: any) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctxParams = (context && context.params) ? await context.params : undefined;
    const id = ctxParams?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Checklist id is required' }, { status: 400 });
    }

    const data = await loadChecklist(id);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('checklists [id] GET error', e);
    return NextResponse.json({ success: false, error: 'Failed to load checklist' }, { status: 500 });
  }
}



export async function PUT(request: NextRequest, context: any) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ctxParams = (context && context.params) ? await context.params : undefined;
    const id = ctxParams?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Checklist id is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => null) as any;
    const name = body?.name?.toString?.().trim();
    const description = (body?.description ?? '').toString();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one item is required' }, { status: 400 });
    }
    // Basic item validation
    const normalizedItems = items.map((it: any, idx: number) => ({
      id: typeof it.id === 'number' ? it.id : idx + 1,
      description: (it.description ?? '').toString(),
      criteria: (it.criteria ?? '').toString(),
    }));
    if (normalizedItems.some((it: any) => !it.description.trim())) {
      return NextResponse.json({ success: false, error: 'Each item must have a description' }, { status: 400 });
    }

    const updated = await saveChecklist({ id, name, description, items: normalizedItems });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error('checklists [id] PUT error', e);
    return NextResponse.json({ success: false, error: 'Failed to update checklist' }, { status: 500 });
  }
}
