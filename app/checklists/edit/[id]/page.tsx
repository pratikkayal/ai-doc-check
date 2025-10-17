"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

interface ItemRow { id: number; description: string; criteria: string; }

export default function EditChecklistPage() {
  const router = useRouter();
  const params = useParams();
  const id = useMemo(() => (params?.id ? String(params.id) : ''), [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!id) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/checklists/${id}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load checklist');
        if (!active) return;
        setName(json.data.name || '');
        setDescription(json.data.description || '');
        const loaded: ItemRow[] = Array.isArray(json.data.items) ? json.data.items : [];
        const normalized = loaded.map((it: any, idx: number) => ({
          id: typeof it.id === 'number' ? it.id : idx + 1,
          description: (it.description ?? '').toString(),
          criteria: (it.criteria ?? '').toString(),
        }));
        setItems(normalized.length ? normalized : [{ id: 1, description: '', criteria: '' }]);
      } catch (e: any) {
        toast({ title: 'Load failed', description: String(e.message || e), variant: 'destructive' });
      } finally {
        if (active) setLoading(false);
      }
    }
    run();
    return () => { active = false; };
  }, [id]);

  const addRow = () => setItems(prev => {
    const maxId = prev.length > 0 ? Math.max(...prev.map(i => i.id)) : 0;
    return [...prev, { id: maxId + 1, description: '', criteria: '' }];
  });
  const removeRow = (rid: number) => setItems(prev => prev.filter(i => i.id !== rid).map((i, idx) => ({ ...i, id: idx + 1 })));
  const updateRow = (rid: number, field: keyof ItemRow, value: string) => setItems(prev => prev.map(i => i.id === rid ? { ...i, [field]: value } : i));

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Name required', description: 'Please provide a checklist name', variant: 'destructive' }); return; }
    if (items.length === 0 || items.some(i => !i.description.trim())) { toast({ title: 'Items required', description: 'Please add at least one item and fill description', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/checklists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save changes');
      toast({ title: 'Checklist updated', description: `Saved: ${data.data.name}` });
      router.push('/dashboard');
    } catch (e: any) {
      toast({ title: 'Save failed', description: String(e.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Edit Checklist</h1>
          <p className="text-gray-600">Update the checklist name, description, and items.</p>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading checklist...</div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Checklist name" />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short summary (optional)" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Checklist Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map(row => (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-1 text-sm text-gray-500">{row.id}</div>
                    <div className="md:col-span-4">
                      <Label htmlFor={`item-description-${row.id}`}>Item description</Label>
                      <Input id={`item-description-${row.id}`} value={row.description} onChange={e => updateRow(row.id, 'description', e.target.value)} placeholder="e.g., Education Verification" />
                    </div>
                    <div className="md:col-span-6">
                      <Label htmlFor={`item-criteria-${row.id}`}>Criteria</Label>
                      <Input id={`item-criteria-${row.id}`} value={row.criteria} onChange={e => updateRow(row.id, 'criteria', e.target.value)} placeholder="e.g., Verify degrees and institutions" />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button variant="ghost" onClick={() => removeRow(row.id)} disabled={items.length === 1}>Remove</Button>
                    </div>
                  </div>
                ))}
                <div>
                  <Button variant="outline" onClick={addRow}>Add Item</Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.push('/dashboard')}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

