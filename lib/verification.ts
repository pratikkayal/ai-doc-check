import { readFile, writeFile } from 'fs/promises';
import { VerificationResult, Evidence } from '@/types';
import { extractDocumentText } from '@/lib/pdf-utils';

/**
 * Load and sanitize document text once per processing session.
 */
export async function loadDocumentText(documentPath: string): Promise<{ text: string; source: string }> {
  let documentContent = '';
  let contentSource = 'unknown';
  const sanitize = (s: string) => s.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

  try {
    const textFilePath = `${documentPath}.txt`;
    const fileBuffer = await readFile(textFilePath, 'utf-8');
    documentContent = fileBuffer.substring(0, 10000);
    contentSource = 'txt-cache';
  } catch (readError) {
    console.error('Error reading extracted text:', readError);

    try {
      console.log('Attempting to extract text from original file...');
      const fileType = documentPath.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      const extractedText = await extractDocumentText(documentPath, fileType);
      documentContent = extractedText.substring(0, 10000);
      contentSource = 'extracted-on-the-fly';

      // Save for future use
      await writeFile(`${documentPath}.txt`, extractedText, 'utf-8');
      console.log(`Extracted and saved ${extractedText.length} characters`);
    } catch (extractError) {
      console.error('Error extracting text from document:', extractError);

      try {
        if (!documentPath.toLowerCase().endsWith('.pdf')) {
          const fileBuffer = await readFile(documentPath, 'utf-8');
          documentContent = String(fileBuffer).substring(0, 10000);
          contentSource = 'fallback-plain';
        } else {
          console.warn('Skipping raw PDF read as text to avoid binary content in prompt.');
          documentContent = '';
          contentSource = 'none';
        }
      } catch (fallbackError) {
        console.error('Error reading document:', fallbackError);
        documentContent = '';
        contentSource = 'none';
      }
    }
  }

  documentContent = sanitize(documentContent).trim();
  const preview = documentContent.slice(0, 200);
  console.log(`[LOAD] Content source: ${contentSource}; length=${documentContent.length}; preview=`, preview);

  return { text: documentContent, source: contentSource };
}

/** Determine max concurrency for LLM calls (env override). */
export function getMaxConcurrency(): number {
  const raw = process.env.DATABRICKS_MAX_CONCURRENCY || '5';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

// ----- Databricks Adapters -----

async function callRealDatabricksAPI(
  token: string,
  documentText: string,
  checklistItem: any
): Promise<VerificationResult> {
  try {
    const sanitize = (s: string) => s.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
    const documentContent = sanitize(documentText).substring(0, 10000).trim();
    const preview = documentContent.slice(0, 200);
    console.log(`[VERIFY] Using provided text; length=${documentContent.length}; preview=`, preview);

    const prompt = `You are a document verification assistant. Analyze the following document text and determine if it contains the required information.

Document Content (${documentContent.length} characters):
${documentContent}

Verification Criteria:
${checklistItem.description}: ${checklistItem.criteria}

IMPORTANT: For each piece of evidence, return TOKEN-BASED ANCHORS instead of character offsets.
Return the first TWO tokens of the evidence text and the last TWO tokens of the evidence text.
Also include the FULL evidence text for validation. If you know the page number, include it as page_number; otherwise use null.

Respond in the following JSON format:
{
  "status": "verified" | "failed",
  "evidence_tokens": [
    { "start_tokens": ["<first token>", "<second token>"], "end_tokens": ["<second to last>", "<last>"], "full_text": "<exact evidence text>", "page_number": <number or null> }
  ],
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation>"
}

Rules:
1. Tokens are whitespace-separated words appearing EXACTLY in the document order.
2. full_text MUST start with start_tokens joined by a space and end with end_tokens joined by a space.
3. Include ALL relevant evidence segments.
4. Keep full_text concise (<= 300 chars). Do not include JSON outside the object.`;

    const response = await fetch('https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/databricks-gpt-oss-120b/invocations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 5000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Databricks API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    let llmResponse = data.choices?.[0]?.message?.content || '';
    if (Array.isArray(llmResponse)) {
      const textObject = llmResponse.find((item: any) => item.type === 'text');
      llmResponse = textObject?.text || '';
    }

    let parsedResult: any;
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsedResult = JSON.parse(jsonMatch[0]);
      else throw new Error('No JSON found in response');
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      console.log('Raw LLM response:', llmResponse);
      const responseText = typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse);
      const isVerified = responseText.toLowerCase().includes('verified') || responseText.toLowerCase().includes('found') || responseText.toLowerCase().includes('yes');
      parsedResult = {
        status: isVerified ? 'verified' : 'failed',
        evidence_ranges: [],
        evidence_text: responseText.substring(0, 200),
        confidence: 0.5,
        reasoning: 'Response parsing failed, using text analysis',
      };
    }

    const tokensArr = Array.isArray(parsedResult.evidence_tokens) ? parsedResult.evidence_tokens : [];
    const validatedTokens = tokensArr
      .map((t: any) => {
        const st = Array.isArray(t?.start_tokens) ? t.start_tokens.slice(0, 2).map(String) : [];
        const et = Array.isArray(t?.end_tokens) ? t.end_tokens.slice(-2).map(String) : [];
        const full = typeof t?.full_text === 'string' ? t.full_text : '';
        const pg = Number.isFinite(Number(t?.page_number)) ? Number(t.page_number) : undefined;
        if (st.length !== 2 || et.length !== 2 || !full) return null;
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
        const fullNorm = norm(full);
        const stNorm = norm(st.join(' '));
        const etNorm = norm(et.join(' '));
        if (!fullNorm.startsWith(stNorm) || !fullNorm.endsWith(etNorm)) {
          // still accept but keep as-is for UI
        }
        return { startTokens: [st[0], st[1]] as [string, string], endTokens: [et[0], et[1]] as [string, string], fullText: full, pageNumber: pg };
      })
      .filter(Boolean) as { startTokens: [string, string]; endTokens: [string, string]; fullText: string; pageNumber?: number }[];

    return {
      itemId: checklistItem.id,
      status: parsedResult.status === 'verified' ? 'verified' : 'failed',
      evidence: {
        text: parsedResult.evidence_text || validatedTokens[0]?.fullText || 'No evidence provided',
        confidence: typeof parsedResult.confidence === 'number' ? parsedResult.confidence : 0.5,
        tokens: validatedTokens,
      },
      reason: parsedResult.reasoning || parsedResult.reason || 'Verification completed',
    };
  } catch (error) {
    console.error('Databricks API error:', error);
    return {
      itemId: checklistItem.id,
      status: 'failed',
      evidence: {
        text: 'API call failed',
        pageNumber: 1,
        confidence: 0,
      },
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function callSimulatedAPI(
  _token: string,
  documentText: string,
  checklistItem: any
): Promise<VerificationResult> {
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  const haystack = documentText || '';
  const keywords = String(`${checklistItem.description} ${checklistItem.criteria}`)
    .split(/[^A-Za-z0-9]+/)
    .filter((w: string) => w.length >= 4)
    .slice(0, 5);

  let tokens: { startTokens: [string, string]; endTokens: [string, string]; fullText: string; pageNumber?: number }[] = [];
  let isVerified = false;
  for (const kw of keywords) {
    const idx = haystack.toLowerCase().indexOf(kw.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(haystack.length, idx + kw.length + 20);
      const snippet = haystack.substring(start, end).trim();
      const words = snippet.split(/\s+/).filter(Boolean);
      if (words.length >= 4) {
        const st: [string, string] = [words[0], words[1]];
        const et: [string, string] = [words[words.length - 2], words[words.length - 1]];
        tokens = [{ startTokens: st, endTokens: et, fullText: snippet }];
        isVerified = true;
        break;
      }
    }
  }

  const evidence: Evidence = {
    text: isVerified ? `Found evidence for ${checklistItem.description}` : `Not found: ${checklistItem.description}`,
    confidence: isVerified ? 0.8 : 0.4,
    tokens,
  };

  return {
    itemId: checklistItem.id,
    status: isVerified ? 'verified' : 'failed',
    evidence,
    reason: isVerified ? 'Criteria met' : 'Required information not found in document',
  };
}

/** Route to the real/simulated Databricks flow based on env. */
export async function callDatabricksAPI(
  token: string,
  documentText: string,
  checklistItem: any
): Promise<VerificationResult> {
  const useRealAPI = process.env.USE_REAL_API === 'true';
  if (useRealAPI) {
    console.log(`[REAL API] Processing item ${checklistItem.id}: ${checklistItem.description}`);
    return callRealDatabricksAPI(token, documentText, checklistItem);
  } else {
    console.log(`[SIMULATED API] Processing item ${checklistItem.id}: ${checklistItem.description}`);
    return callSimulatedAPI(token, documentText, checklistItem);
  }
}

