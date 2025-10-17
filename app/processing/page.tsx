"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentStore } from "@/store/useDocumentStore";
import { CheckCircle2, X, Loader2, Circle, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { VerificationResult } from "@/types";

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filename = searchParams.get("filename");
  const documentPath = searchParams.get("path");
  const checklistId = searchParams.get("checklistId");

  const { checklist, setChecklist, updateChecklistItem, setReport, setCurrentProcessingItem } = useDocumentStore();

  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<VerificationResult[]>([]);

  useEffect(() => {
    if (!filename || !documentPath || !checklistId) {
      router.push("/dashboard");
      return;
    }

    let eventSource: EventSource | null = null;
    const collectedResults: VerificationResult[] = [];
    let isProcessing = false;

    if (isProcessing) return;
    isProcessing = true;

    try {
      eventSource = new EventSource(
        `/api/process?filename=${encodeURIComponent(filename)}&documentPath=${encodeURIComponent(documentPath)}&checklistId=${encodeURIComponent(checklistId)}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data) as import('@/types').ProcessSSEvent;

        if (data.type === 'processing') {
          setCurrentProcessingItem(data.itemId);
          updateChecklistItem(data.itemId, { status: 'processing' });
        } else if (data.type === 'result') {
          const result: VerificationResult = data.data;
          collectedResults.push(result);
          setResults([...collectedResults]);
          updateChecklistItem(result.itemId, {
            status: result.status,
            evidence: result.evidence,
          });
          setProgress((collectedResults.length / checklist.length) * 100);
        } else if (data.type === 'complete') {
          eventSource?.close();

          // Calculate summary
          const passed = collectedResults.filter(r => r.status === 'verified').length;
          const failed = collectedResults.length - passed;

          setReport({
            documentName: filename!,
            documentPath: documentPath!,
            uploadDate: new Date().toISOString(),
            processingDate: new Date().toISOString(),
            results: collectedResults,
            summary: {
              total: checklist.length,
              passed,
              failed,
              successRate: (passed / checklist.length) * 100,
            },
            // Metadata from server 'complete' event
            checklistId: data.checklistId,
            checklistName: data.checklistName,
            checklistDescription: data.checklistDescription,
          });

          // Redirect to report page
          setTimeout(() => {
            router.push("/report");
          }, 1000);
        } else if (data.type === "error") {
          eventSource?.close();
          console.error("Processing error:", data.error);
          router.push("/dashboard");
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        console.error("EventSource error");
        router.push("/dashboard");
      };
    } catch (error) {
      console.error("Processing error:", error);
      router.push("/dashboard");
    }

    return () => {
      eventSource?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Processing Document</h1>
          <p className="text-gray-600 mt-2">Verifying document against checklist...</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Animated Checklist */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Verification Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-semibold text-primary">{Math.round(Math.min(progress, 100))}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="bg-primary h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {checklist.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        item.status === 'processing'
                          ? 'bg-blue-50 border-blue-300 shadow-sm'
                          : item.status === 'verified'
                          ? 'bg-green-50 border-green-300'
                          : item.status === 'failed'
                          ? 'bg-red-50 border-red-300'
                          : 'bg-white border-gray-200'
                      }`}
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

          {/* Right Panel - Document Processing Visualization */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Document Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="mb-8"
                  >
                    <FileText className="w-24 h-24 text-primary" />
                  </motion.div>

                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Analyzing Document</h3>
                  <p className="text-gray-600 mb-8">Processing {filename}</p>

                  <div className="w-40 max-w-md">
                    <motion.div
                      className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                      animate={{
                        x: ["-100%", "100%"],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </div>

                  <div className="mt-12 text-center">
                    <p className="text-sm text-gray-500">
                      Using Databricks API to verify document contents
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      This may take a few moments...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ProcessingContent />
    </Suspense>
  );
}

