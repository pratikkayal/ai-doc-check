import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { loadChecklist } from '@/lib/checklists';
import { VerificationResult } from '@/types';
import { readFile } from 'fs/promises';
import { loadDocumentText, callDatabricksAPI, getMaxConcurrency } from '@/lib/verification';






export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session.databricksToken || !session.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { filename, documentPath, checklistId } = body || {};

    if (!filename || !documentPath || !checklistId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters (filename, documentPath, checklistId)' },
        { status: 400 }
      );
    }

    // Verify file exists
    try {
      await readFile(documentPath);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Load selected checklist
    const checklistData = await loadChecklist(checklistId);
    if (!checklistData) {
      return NextResponse.json(
        { success: false, error: 'Checklist ID required or not found' },
        { status: 400 }
      );
    }
    const activeChecklist = checklistData.items || [];

    // Load document text once to ensure we never read/send binary PDF
    // Concurrency limit for Databricks calls (env override)


    const { text: documentText, source: loadSource } = await loadDocumentText(documentPath);
    console.log(`[PROCESS] Loaded document text from ${loadSource}; length=${documentText.length}`);


    // Process checklist items with configurable concurrency limit
    const maxC = getMaxConcurrency();
    const results: VerificationResult[] = [];
    for (let i = 0; i < activeChecklist.length; i += maxC) {
      const slice = activeChecklist.slice(i, i + maxC);
      const batch = await Promise.all(
        slice.map((item) => callDatabricksAPI(session.databricksToken!, documentText, item))
      );
      results.push(...batch);
    }

    // Calculate summary
    const passed = results.filter(r => r.status === 'verified').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      data: {
        documentName: filename,
        documentPath,
        uploadDate: new Date().toISOString(),
        processingDate: new Date().toISOString(),
        results,
        summary: {
          total: results.length,
          passed,
          failed,
          successRate: (passed / results.length) * 100,
        },
        checklistId,
        checklistName: checklistData.name,
        checklistDescription: checklistData.description,
        checklistCreatedAt: checklistData.createdAt,
      },
    });
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process document' },
      { status: 500 }
    );
  }
}

// Server-Sent Events endpoint for real-time updates
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filename = searchParams.get('filename');
  const documentPath = searchParams.get('documentPath');
  const checklistId = searchParams.get('checklistId');

  if (!filename || !documentPath || !checklistId) {
    return NextResponse.json(
      { success: false, error: 'Missing parameters' },
      { status: 400 }
    );
  }

  const session = await getSession();

  if (!session.databricksToken || !session.isAuthenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }

    );
  }

  // Load selected checklist
  const checklistData = await loadChecklist(checklistId);
  if (!checklistData) {
    return NextResponse.json(
      { success: false, error: 'Checklist ID required or not found' },
      { status: 400 }
    );
  }
  const activeChecklist = checklistData.items || [];

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Load document text once for SSE session
        const { text: documentText, source: sseSource } = await loadDocumentText(documentPath);
        console.log(`[SSE] Loaded document text from ${sseSource}; length=${documentText.length}`);

        // Send processing status for all items upfront


        for (let i = 0; i < activeChecklist.length; i++) {
          const item = activeChecklist[i];
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'processing', itemId: item.id })}\n\n`)
          );
        }

        // Process items with concurrency limit and stream results per batch
        const maxC = getMaxConcurrency();
        for (let start = 0; start < activeChecklist.length; start += maxC) {
          const slice = activeChecklist.slice(start, start + maxC);
          await Promise.allSettled(
            slice.map((item) =>
              callDatabricksAPI(session.databricksToken!, documentText, item)
                .then((result) => {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`)
                  );
                })
                .catch((error) => {
                  console.error('SSE item error:', error);
                  const fallback = {
                    itemId: item.id,
                    status: 'failed',
                    evidence: { text: 'API error', pageNumber: 1, confidence: 0 },
                    reason: 'Processing failed',
                  } as VerificationResult;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'result', data: fallback })}\n\n`)
                  );
                })
            )
          );
        }

        // Send completion after all have settled
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'complete', checklistId, checklistName: checklistData.name, checklistDescription: checklistData.description, checklistCreatedAt: checklistData.createdAt })}\n\n`)
        );
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Processing failed', code: 'PROCESSING_ERROR', detail: { filename, checklistId } })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

