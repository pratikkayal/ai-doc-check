import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

interface GenerateBody {
  documentType?: string;
  customDescription?: string;
  itemCount?: number;
}

interface BareGeneratedItem {
  description: string;
  criteria: string;
}

function buildPrompt(documentType: string, customDescription?: string, itemCount?: number): string {
  const count = Math.min(Math.max(itemCount || 6, 3), 12);
  return `You are a document verification expert. Generate a checklist for verifying a ${documentType}.

${customDescription ? `Additional context: ${customDescription}\n\n` : ''}Generate ${count} checklist items. Each item should have:
- description: A clear, concise description of what to verify
- criteria: Specific, measurable criteria for verification

Return ONLY a valid JSON array in this exact format:
[
  {"description": "...", "criteria": "..."}
]

Do not include any other text or explanation.`;
}

async function callDatabricksForGeneration(token: string, prompt: string, timeoutMs = 25000): Promise<BareGeneratedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/databricks-gpt-oss-120b/invocations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Databricks API error: ${res.status} ${res.statusText} - ${t}`);
    }

    const data = await res.json();
    let content: string = data?.choices?.[0]?.message?.content ?? '';
    if (Array.isArray(content)) {
      const textObj = content.find((c: any) => c?.type === 'text');
      content = textObj?.text ?? '';
    }

    // Try strict JSON parse first
    try {
      const arr = JSON.parse(content);
      if (Array.isArray(arr)) {
        return arr
          .map((it: any) => ({ description: String(it?.description ?? '').trim(), criteria: String(it?.criteria ?? '').trim() }))
          .filter((it: BareGeneratedItem) => it.description && it.criteria);
      }
    } catch {}

    // Try to extract JSON array with a regex fallback
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) {
          return arr
            .map((it: any) => ({ description: String(it?.description ?? '').trim(), criteria: String(it?.criteria ?? '').trim() }))
            .filter((it: BareGeneratedItem) => it.description && it.criteria);
        }
      } catch {}
    }

    // Last-resort parsing: split lines and attempt to build items
    const lines = String(content).split(/\n+/).map(l => l.trim()).filter(Boolean);
    const coarse: BareGeneratedItem[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const desc = line.replace(/^[-*]\s*/, '');
      const next = lines[i + 1] || '';
      if (desc && next.toLowerCase().includes('criteria')) {
        coarse.push({ description: desc, criteria: next.replace(/^criteria[:\-\s]*/i, '') });
        i++;
      }
    }
    if (coarse.length > 0) return coarse;

    throw new Error('LLM returned an unparseable response');
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const e = new Error('LLM timeout');
      (e as any).code = 'LLM_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function simulateGeneration(documentType: string, count: number): BareGeneratedItem[] {
  const base: Record<string, BareGeneratedItem[]> = {
    Resume: [
      { description: 'Contact information present', criteria: 'Name, email, and phone number are clearly listed' },
      { description: 'Work experience relevance', criteria: 'Experience aligns with target role; includes quantifiable achievements' },
      { description: 'Education details', criteria: 'Degree, institution, and graduation date included' },
      { description: 'Skills section completeness', criteria: 'Technical and soft skills listed; matches job requirements' },
      { description: 'Formatting and consistency', criteria: 'Consistent dates, bullet styles, and tense' },
      { description: 'ATS-friendly structure', criteria: 'Avoids tables/images; uses standard headings and keywords' },
    ],
    Contract: [
      { description: 'Parties identified', criteria: 'Legal names and addresses of all parties are included' },
      { description: 'Scope of work', criteria: 'Deliverables and responsibilities clearly defined' },
      { description: 'Payment terms', criteria: 'Amount, schedule, and method specified' },
      { description: 'Termination clause', criteria: 'Conditions for termination and notice periods specified' },
      { description: 'Governing law', criteria: 'Jurisdiction and dispute resolution process stated' },
      { description: 'Signatures', criteria: 'Signatures or e-sign confirmation for all parties present' },
    ],
    Invoice: [
      { description: 'Invoice identifiers', criteria: 'Invoice number and issue date present' },
      { description: 'Vendor and client details', criteria: 'Names and contact information of both parties present' },
      { description: 'Line items', criteria: 'Items/services listed with quantity, rate, and total' },
      { description: 'Tax and totals', criteria: 'Tax applied correctly; subtotal and grand total accurate' },
      { description: 'Payment instructions', criteria: 'Due date and payment method specified' },
      { description: 'Purchase order reference', criteria: 'PO number included if applicable' },
    ],
  };

  const pool = base[documentType] || base['Resume'];
  const result: BareGeneratedItem[] = [];
  for (let i = 0; i < Math.max(3, Math.min(count, 12)); i++) {
    result.push(pool[i % pool.length]);
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;
    console.log('[AI Generate] Request body:', body);
    const documentType = (body.documentType || '').trim() || 'Document';
    const customDescription = (body.customDescription || '').trim() || undefined;
    const itemCount = Number.isFinite(body.itemCount as number) ? Math.max(1, Math.min(Number(body.itemCount), 20)) : 6;

    const prompt = buildPrompt(documentType, customDescription, itemCount);

    const useRealAPI = process.env.USE_REAL_API === 'true';

    let items: BareGeneratedItem[];
    if (useRealAPI) {
      const session = await getSession();
      if (!session?.databricksToken || !session?.isAuthenticated) {
        return NextResponse.json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      }
      try {
        items = await callDatabricksForGeneration(session.databricksToken, prompt);
      } catch (err: any) {
        if (err?.code === 'LLM_TIMEOUT') {
          return NextResponse.json({ success: false, error: 'LLM timeout', code: 'LLM_TIMEOUT' }, { status: 504 });
        }
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ success: false, error: 'Generation failed', code: 'LLM_GENERATION_FAILED', detail: msg }, { status: 502 });
      }
    } else {
      // Simulated mode does not require auth/session
      items = simulateGeneration(documentType, itemCount);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid LLM response', code: 'LLM_INVALID_RESPONSE' }, { status: 502 });
    }

    return NextResponse.json({ success: true, items }, { status: 200 });
  } catch (error) {
    console.error('[AI Generate] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

