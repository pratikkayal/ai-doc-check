import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat, readdir } from 'fs/promises';
import { createReadStream } from 'fs';
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

    const range = request.headers.get('range');
    async function respond(filePath: string, name: string, resolvedNameHeader?: string) {
      const s = await stat(filePath);
      const total = s.size;
      if (range) {
        const m = /bytes=(\d+)-(\d+)?/.exec(range);
        if (!m) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${total}` },
          });
        }
        const start = Math.min(parseInt(m[1], 10), total - 1);
        const end = Math.min(m[2] ? parseInt(m[2], 10) : total - 1, total - 1);
        if (start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${total}` },
          });
        }
        const stream = createReadStream(filePath, { start, end });
        return new NextResponse(stream as any, {
          status: 206,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${name}"`,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': String(end - start + 1),
            'Cache-Control': 'no-store',
            ...(resolvedNameHeader ? { 'X-Resolved-Filename': resolvedNameHeader } : {}),
          },
        });
      }
      const buf = await readFile(filePath);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${name}"`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(total),
          'Cache-Control': 'no-store',
          ...(resolvedNameHeader ? { 'X-Resolved-Filename': resolvedNameHeader } : {}),
        },
      });
    }

    try {
      console.info('serve-pdf GET primary', { filename, filepath, range: range || null });
      return await respond(filepath, filename);
    } catch (error) {
      // Fallback: try to resolve latest file by original name suffix (after first '-')
      try {
        const dash = filename.indexOf('-');
        if (dash > 0) {
          const originalSuffix = filename.slice(dash + 1);
          const files = await readdir(uploadsDir);
          const matches = files.filter(f => f.endsWith(originalSuffix));
          if (matches.length) {
            const pick = matches.map(f => ({ f, ts: Number.parseInt(f.split('-')[0]) || 0 }))
              .sort((a, b) => b.ts - a.ts)[0].f;
            const altPath = path.join(uploadsDir, pick);
            console.warn('serve-pdf GET fallback resolving', { requested: filename, resolved: pick, altPath, range: range || null });
            return await respond(altPath, pick, pick);
          }
        }
      } catch (e) {
        console.error('serve-pdf GET fallback error', { filename, error: String(e) });
      }
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


export async function HEAD(request: NextRequest) {
  try {
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

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filepath = path.join(uploadsDir, filename);

    try {
      const s = await stat(filepath);
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(s.size),
          'Content-Disposition': `inline; filename="${filename}"`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      // Fallback: resolve latest by original name suffix
      try {
        const dash = filename.indexOf('-');
        if (dash > 0) {
          const originalSuffix = filename.slice(dash + 1);
          const files = await readdir(uploadsDir);
          const matches = files.filter(f => f.endsWith(originalSuffix));
          if (matches.length) {
            const pick = matches.map(f => ({ f, ts: Number.parseInt(f.split('-')[0]) || 0 }))
              .sort((a, b) => b.ts - a.ts)[0].f;
            const s2 = await stat(path.join(uploadsDir, pick));
            return new NextResponse(null, {
              status: 200,
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Length': String(s2.size),
                'Content-Disposition': `inline; filename="${pick}"`,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-store',
                'X-Resolved-Filename': pick,
              },
            });
          }
        }
      } catch (e) {
        // ignore
      }
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Serve PDF HEAD error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve PDF (HEAD)' },
      { status: 500 }
    );
  }
}
