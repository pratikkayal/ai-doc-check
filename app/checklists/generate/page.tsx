"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface BareGeneratedItem { description: string; criteria: string }

export default function GenerateChecklistPage() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState("Resume");
  const [customDescription, setCustomDescription] = useState("");
  const [itemCount, setItemCount] = useState<number>(6);
  const [isGenerating, setIsGenerating] = useState(false);
  const [items, setItems] = useState<Array<{ id: number; description: string; criteria: string }>>([]);
  const [name, setName] = useState("Resume Checklist (AI)");
  const [description, setDescription] = useState("Generated with AI based on your inputs.");

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/checklists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType, customDescription, itemCount }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to generate");
      }
      const generated: BareGeneratedItem[] = json.items || [];
      const withIds = generated.map((g: BareGeneratedItem, idx: number) => ({ id: idx + 1, description: g.description, criteria: g.criteria }));
      setItems(withIds);
      setName(`${documentType} Checklist (AI)`);
      setDescription(customDescription || `AI-generated checklist for a ${documentType}.`);
      toast({ title: "Checklist generated", description: `${withIds.length} items created. You can edit before saving.` });
    } catch (error) {
      console.error('AI generation error:', error);
      // Client-side fallback to keep UX unblocked in dev/simulated environment
      const fallback: BareGeneratedItem[] = [
        { description: `${documentType}: Primary identifiers present`, criteria: `Includes core identifiers relevant to ${documentType}` },
        { description: `${documentType}: Key content completeness`, criteria: `Essential fields for ${documentType} are filled and consistent` },
        { description: `${documentType}: Formatting consistency`, criteria: `Consistent formatting, dates, and structure` },
      ];
      const withIds = fallback.map((g, idx) => ({ id: idx + 1, description: g.description, criteria: g.criteria }));
      setItems(withIds);
      setName(`${documentType} Checklist (AI)`);
      setDescription(customDescription || `AI-generated checklist for a ${documentType}.`);
      toast({ title: "Checklist generated (fallback)", description: `LLM unavailable; generated ${withIds.length} placeholder items.`, variant: "default" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || items.length === 0) {
      toast({ title: "Cannot save", description: "Name is required and there must be at least one item.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), items }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Save failed");
      toast({ title: "Checklist saved", description: `Saved "${json.data.name}" with ${json.data.items.length} items.` });
      setTimeout(() => router.push("/dashboard"), 800);
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const regenerate = async () => {
    await handleGenerate();
  };

  const updateItem = (id: number, field: "description" | "criteria", value: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const addItem = () => {
    const maxId = items.length > 0 ? Math.max(...items.map(i => i.id)) : 0;
    setItems(prev => [...prev, { id: maxId + 1, description: "", criteria: "" }]);
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Generate Checklist with AI</h1>
            <p className="text-gray-600 mt-2">Describe your document and let AI draft a checklist. Review and edit before saving.</p>
          </div>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Provide details for the AI to generate a relevant checklist.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-700">Document Type</label>
                <Input value={documentType} onChange={(e) => setDocumentType(e.target.value)} placeholder="e.g., Resume, Contract, Invoice" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Number of Items</label>
                <Input type="number" value={itemCount} min={3} max={12} onChange={(e) => setItemCount(parseInt(e.target.value || '6', 10))} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                  {isGenerating ? 'Generating…' : 'Generate'}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-700">Custom Description (optional)</label>
              <textarea
                className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring focus:ring-primary/30"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Add context or specific requirements for the checklist"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Edit</CardTitle>
              <CardDescription>Edit generated items and provide a name/description before saving.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-700">Checklist Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Checklist Description</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-500">Item #{item.id}</div>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>Remove</Button>
                    </div>
                    <div className="space-y-2">
                      <Input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="Description" />
                      <textarea
                        className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring focus:ring-primary/30"
                        value={item.criteria}
                        onChange={(e) => updateItem(item.id, 'criteria', e.target.value)}
                        placeholder="Criteria"
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={addItem}>Add Item</Button>
                <Button variant="secondary" onClick={regenerate}>Regenerate</Button>
                <Button onClick={handleSave}>Save Checklist</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

