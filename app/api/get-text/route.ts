import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { isAuthenticated } from '@/lib/session';
import { extractDocumentText } from '@/lib/pdf-utils';

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ success: false, error: 'Filename is required' }, { status: 400 });
    }

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ success: false, error: 'Invalid filename' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filepath = path.join(uploadsDir, filename);

    // Try to read cached text first
    try {
      const text = await readFile(filepath + '.txt', 'utf-8');
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch {}

    // Fallback: extract text on the fly based on extension
    const fileType = filename.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    try {
      const extracted = await extractDocumentText(filepath, fileType);
      return new NextResponse(extracted, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (error) {
      return NextResponse.json({ success: false, error: 'File not found or cannot extract text' }, { status: 404 });
    }
  } catch (error) {
    console.error('Serve Text error:', error);
    return NextResponse.json({ success: false, error: 'Failed to serve text' }, { status: 500 });
  }
}

