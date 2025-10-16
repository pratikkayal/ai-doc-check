import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { isAuthenticated } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Read the PDF file
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filepath = path.join(uploadsDir, filename);

    try {
      const fileBuffer = await readFile(filepath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Serve PDF error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve PDF' },
      { status: 500 }
    );
  }
}

