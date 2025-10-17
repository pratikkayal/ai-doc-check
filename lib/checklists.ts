import { promises as fs } from 'fs';
import path from 'path';
import { defaultChecklist } from '@/lib/checklist-data';
import { ChecklistDefinition, ChecklistItemDefinition } from '@/types';


const CHECKLISTS_DIR = path.join(process.cwd(), 'checklists');

async function ensureDir() {
  await fs.mkdir(CHECKLISTS_DIR, { recursive: true });
}

async function ensurePresetsExist(): Promise<void> {
  await ensureDir();
  const files = await fs.readdir(CHECKLISTS_DIR).catch(() => [] as string[]);
  const existing: Record<string, boolean> = {};
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(CHECKLISTS_DIR, f), 'utf-8');
      const data = JSON.parse(raw) as ChecklistDefinition;
      existing[data.name] = true;
    } catch {}
  }

  const now = new Date().toISOString();

  // Full Resume Checklist preset
  if (!existing['Full Resume Checklist']) {
    const fullId = 'full-resume-checklist';
    const fullPayload: ChecklistDefinition = {
      id: fullId,
      name: 'Full Resume Checklist',
      description: 'Complete resume verification covering contact, summary, work experience, education, skills, formatting, achievements, and optional sections.',
      items: defaultChecklist.map(it => ({ id: it.id, description: it.description, criteria: it.criteria })),
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(path.join(CHECKLISTS_DIR, `${fullId}.json`), JSON.stringify(fullPayload, null, 2), 'utf-8');
  }

  // Small Resume Checklist preset (3 items: contact, work experience, education)
  if (!existing['Small Resume Checklist']) {
    const smallId = 'small-resume-checklist';
    const pickIds = new Set([1, 3, 4]);
    const smallItems = defaultChecklist
      .filter(it => pickIds.has(it.id))
      .map(it => ({ id: it.id, description: it.description, criteria: it.criteria }));
    const smallPayload: ChecklistDefinition = {
      id: smallId,
      name: 'Small Resume Checklist',
      description: 'Minimal resume verification: contact, work experience, and education.',
      items: smallItems,
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(path.join(CHECKLISTS_DIR, `${smallId}.json`), JSON.stringify(smallPayload, null, 2), 'utf-8');
  }
}

export async function listChecklists(): Promise<Array<Pick<ChecklistDefinition, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & { itemCount: number }>> {
  await ensurePresetsExist();
  const files = await fs.readdir(CHECKLISTS_DIR).catch(() => [] as string[]);
  const result: Array<Pick<ChecklistDefinition, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & { itemCount: number }> = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(CHECKLISTS_DIR, f), 'utf-8');
      const data: ChecklistDefinition = JSON.parse(raw);
      result.push({ id: data.id, name: data.name, description: data.description, createdAt: data.createdAt, updatedAt: data.updatedAt, itemCount: data.items?.length || 0 });
    } catch {
      // ignore malformed
    }
  }
  // Sort latest first
  result.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return result;
}

export async function loadChecklist(id: string): Promise<ChecklistDefinition | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(CHECKLISTS_DIR, `${id}.json`), 'utf-8');
    return JSON.parse(raw) as ChecklistDefinition;
  } catch {
    return null;
  }
}

export async function saveChecklist(input: Omit<ChecklistDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ChecklistDefinition> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();
  const existing = input.id ? await loadChecklist(id) : null;
  const payload: ChecklistDefinition = {
    id,
    name: input.name,
    description: input.description,
    items: (input.items || []) as ChecklistItemDefinition[],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await fs.writeFile(path.join(CHECKLISTS_DIR, `${id}.json`), JSON.stringify(payload, null, 2), 'utf-8');
  return payload;
}

