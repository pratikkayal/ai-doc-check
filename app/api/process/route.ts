import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { VerificationResult } from '@/types';
import { loadDocumentText, callDatabricksAPI, getMaxConcurrency } from '@/lib/verification';
import { validateProcessRequest, createProcessingEvent, createResultEvent, createCompleteEvent, createErrorEvent } from '@/lib/process-helpers';






export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { filename, documentPath, checklistId } = body || {};

    // Validate request and load checklist
    const { validation, data } = await validateProcessRequest(
      filename,
      documentPath,
      checklistId,
      session.databricksToken
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          code: validation.errorCode,
        },
        { status: validation.statusCode || 500 }
      );
    }

    const { checklistData, token } = data!;
    const activeChecklist = checklistData.items;

    // Load document text once to ensure we never read/send binary PDF
    const { text: documentText, source: loadSource } = await loadDocumentText(documentPath);
    console.log(`[PROCESS] Loaded document text from ${loadSource}; length=${documentText.length}`);

    // Process checklist items with configurable concurrency limit
    const maxC = getMaxConcurrency();
    const results: VerificationResult[] = [];
    for (let i = 0; i < activeChecklist.length; i += maxC) {
      const slice = activeChecklist.slice(i, i + maxC);
      const batch = await Promise.all(
        slice.map((item) => callDatabricksAPI(token, documentText, item))
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
      {
        success: false,
        error: 'Failed to process document',
        code: 'PROCESSING_ERROR',
        detail: error instanceof Error ? error.message : String(error),
      },
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

  const session = await getSession();

  // Validate request and load checklist
  const { validation, data } = await validateProcessRequest(
    filename,
    documentPath,
    checklistId,
    session.databricksToken
  );

  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: validation.error,
        code: validation.errorCode,
      },
      { status: validation.statusCode || 500 }
    );
  }

  const { checklistData, token, documentPath: validatedDocPath, filename: validatedFilename } = data!;
  const activeChecklist = checklistData.items;

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Load document text once for SSE session
        const { text: documentText, source: sseSource } = await loadDocumentText(validatedDocPath);
        console.log(`[SSE] Loaded document text from ${sseSource}; length=${documentText.length}`);

        // Send processing status for all items upfront


        for (let i = 0; i < activeChecklist.length; i++) {
          const item = activeChecklist[i];
          controller.enqueue(encoder.encode(createProcessingEvent(item.id)));
        }

        // Process items with concurrency limit and stream results per batch
        const maxC = getMaxConcurrency();
        for (let start = 0; start < activeChecklist.length; start += maxC) {
          const slice = activeChecklist.slice(start, start + maxC);
          await Promise.allSettled(
            slice.map((item) =>
              callDatabricksAPI(token, documentText, item)
                .then((result) => {
                  controller.enqueue(encoder.encode(createResultEvent(result)));
                })
                .catch((error) => {
                  console.error('SSE item error:', error);
                  const fallback = {
                    itemId: item.id,
                    status: 'failed',
                    evidence: { text: 'API error', pageNumber: 1, confidence: 0 },
                    reason: 'Processing failed',
                  } as VerificationResult;
                  controller.enqueue(encoder.encode(createResultEvent(fallback)));
                })
            )
          );
        }

        // Send completion after all have settled
        controller.enqueue(
          encoder.encode(
            createCompleteEvent(
              checklistData.id,
              checklistData.name,
              checklistData.description,
              checklistData.createdAt
            )
          )
        );
        controller.close();
      } catch (error) {
        console.error('SSE stream error:', error);
        controller.enqueue(
          encoder.encode(
            createErrorEvent(
              'Processing failed',
              'PROCESSING_ERROR',
              { filename: validatedFilename, checklistId: checklistData.id, error: error instanceof Error ? error.message : String(error) }
            )
          )
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

