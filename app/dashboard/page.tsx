"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDocumentStore } from "@/store/useDocumentStore";
import { Upload, FileText, X, Loader2, CheckCircle2, Circle, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const router = useRouter();
  const { checklist, setChecklist, setDocument, selectedChecklistId, setSelectedChecklistId, selectedChecklistName, setSelectedChecklistName } = useDocumentStore();

  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [templates, setTemplates] = useState<Array<{id: string; name: string; description: string; itemCount: number; createdAt: string; updatedAt: string}>>([]);

  useEffect(() => {
    const init = async () => {
      try {
        // Load available checklists
        const resList = await fetch('/api/checklists');
        if (resList.status === 401) { router.push('/'); return; }
        const listJson = await resList.json();
        if (listJson.success) setTemplates(listJson.data);

        // If none exists, fallback to default checklist for compatibility
        if (!listJson.success || listJson.data.length === 0) {
          const response = await fetch("/api/checklist");
          const data = await response.json();
          if (data.success) setChecklist(data.data);
        } else if (selectedChecklistId) {
          // Load previously selected
          const sel = listJson.data.find((t: any) => t.id === selectedChecklistId);
          if (sel) {
            const res = await fetch(`/api/checklists/${sel.id}`);
            const json = await res.json();
            if (json.success) {
              setChecklist(json.data.items);
              setSelectedChecklistName?.(json.data.name);
            }
          }
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load checklists', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [router, setChecklist, selectedChecklistId, setSelectedChecklistName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0];
        toast({
          title: "Upload Error",
          description: error.code === 'file-too-large' 
            ? "File is too large. Maximum size is 10MB."
            : "Invalid file type. Only PDF and DOCX files are allowed.",
          variant: "destructive",
        });
        return;
      }

      if (acceptedFiles.length > 0) {
        setUploadedFile(acceptedFiles[0]);
      }
    },
  });

  const handleProcessDocument = async () => {
    if (!uploadedFile) return;
    if (!selectedChecklistId) {
      toast({ title: 'Select Checklist', description: 'Please select a checklist before processing.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error);
      }

      // Store document metadata
      setDocument({
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type,
        uploadedAt: new Date().toISOString(),
      });

      // Persist selected checklist for downstream pages (defensive)
      try {
        sessionStorage.setItem('selectedChecklistId', selectedChecklistId);
        if (selectedChecklistName) sessionStorage.setItem('selectedChecklistName', selectedChecklistName);
      } catch {}

      // Redirect to processing page with checklistId
      router.push(`/processing?filename=${uploadData.data.filename}&path=${encodeURIComponent(uploadData.data.path)}&checklistId=${encodeURIComponent(selectedChecklistId)}`);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <X className="w-5 h-5 text-red-600" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
            <p className="text-gray-600 mt-2">Select a checklist template or create your own, then upload a document to verify.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/checklists/new')}>
              <Plus className="h-4 w-4 mr-2" /> New Checklist
            </Button>
            <Button variant="default" onClick={() => router.push('/checklists/generate')}>
              ✨ Generate with AI
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Checklist */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Select Verification Checklist</CardTitle>
                <CardDescription>Choose a template to use for this document. You can edit or preview before selecting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {templates.map(t => {
                      const isSelected = selectedChecklistId === t.id;
                      const created = new Date(t.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                      return (
                        <div key={t.id} className={`border rounded-lg p-4 bg-white ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-sm'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-gray-900">{t.name}</h3>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{t.description}</p>
                            </div>
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{t.itemCount} items</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Created: {created}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <Button size="sm" aria-label={`Select checklist ${t.name}`} onClick={async () => {
                              setSelectedChecklistId(t.id);
                              const res = await fetch(`/api/checklists/${t.id}`);
                              const json = await res.json();
                              if (json.success) {
                                setChecklist(json.data.items);
                                setSelectedChecklistName?.(json.data.name);
                              }
                            }}>Select</Button>
                            <Button size="sm" variant="outline" aria-label={`Edit checklist ${t.name}`} onClick={() => router.push(`/checklists/edit/${t.id}`)}>Edit</Button>
                            <Button size="sm" variant="ghost" aria-label={`Preview checklist ${t.name}`} onClick={async () => {
                              if (selectedChecklistId !== t.id) {
                                // lazy load preview items if not selected yet
                                const res = await fetch(`/api/checklists/${t.id}`);
                                const json = await res.json();
                                if (json.success) {
                                  setChecklist(json.data.items);
                                  setSelectedChecklistName?.(json.data.name);
                                  setSelectedChecklistId(t.id);
                                }
                              }
                            }}>Preview</Button>
                          </div>
                        </div>
                      );
                    })}
                    {/* Create new checklist card */}
                    <div className="border-2 border-dashed rounded-lg p-4 flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer" onClick={() => router.push('/checklists/new')}>
                      <div className="text-center">
                        <div className="font-semibold">+ Create New Checklist</div>
                        <div className="text-sm">Start from scratch</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No templates yet. Create one to get started.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Checklist {selectedChecklistName ? `— ${selectedChecklistName}` : ''}</CardTitle>
                <CardDescription>{checklist.length} items to verify</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {checklist.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {item.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.criteria}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusIcon(item.status)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Upload */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>Drag and drop or click to select a file</CardDescription>
              </CardHeader>
              <CardContent>
                {!uploadedFile ? (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-gray-300 hover:border-primary hover:bg-gray-50"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      {isDragActive ? "Drop the file here" : "Drag & drop or click to upload"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Supported formats: PDF, DOCX (Max 10MB)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <FileText className="w-10 h-10 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{uploadedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setUploadedFile(null)}
                        disabled={isUploading}
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    <Button
                      onClick={handleProcessDocument}
                      disabled={isUploading}
                      size="lg"
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Process Document"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

