"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDocumentStore } from "@/store/useDocumentStore";
import { CheckCircle2, X, Download, FileText, ArrowLeft, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";

export default function ReportPage() {
  const router = useRouter();
  const { report, checklist } = useDocumentStore();
  
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!report) {
      router.push("/dashboard");
    }
  }, [report, router]);

  if (!report) {
    return null;
  }

  const handleExport = async (format: 'json' | 'excel' | 'pdf') => {
    setIsExporting(true);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, format }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verification-report-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Report exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'verified' ? 'text-green-600 bg-green-50 border-green-300' : 'text-red-600 bg-red-50 border-red-300';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Verification Report</h1>
            <p className="text-gray-600 mt-2">{report.documentName}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // Save report to session storage for the viewer
                sessionStorage.setItem('verificationReport', JSON.stringify(report));
                router.push('/report-viewer');
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Interactive View
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('json')}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('excel')}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              PDF Report
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Items</p>
                <p className="text-3xl font-bold text-gray-900">{report.summary.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Passed</p>
                <p className="text-3xl font-bold text-green-600">{report.summary.passed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Failed</p>
                <p className="text-3xl font-bold text-red-600">{report.summary.failed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Success Rate</p>
                <p className="text-3xl font-bold text-primary">{report.summary.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Results List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Verification Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {report.results.map((result, index) => {
                    const item = checklist.find(i => i.id === result.itemId);
                    if (!item) return null;

                    return (
                      <motion.div
                        key={result.itemId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setSelectedItem(result.itemId)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedItem === result.itemId
                            ? 'ring-2 ring-primary shadow-md'
                            : 'hover:shadow-sm'
                        } ${getStatusColor(result.status)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-semibold">
                            {result.itemId}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-sm">{item.description}</p>
                              {result.status === 'verified' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </div>
                            <p className="text-xs opacity-90">{item.criteria}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Evidence Details */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedItem ? (
                  <div>
                    {(() => {
                      const result = report.results.find(r => r.itemId === selectedItem);
                      const item = checklist.find(i => i.id === selectedItem);
                      
                      if (!result || !item) return null;

                      return (
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-semibold text-lg mb-2">{item.description}</h3>
                            <p className="text-sm text-gray-600 mb-4">{item.criteria}</p>
                            
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                              result.status === 'verified'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {result.status === 'verified' ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Verified
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4" />
                                  Failed
                                </>
                              )}
                            </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-medium text-sm text-gray-700 mb-2">Evidence</h4>
                            <p className="text-sm text-gray-900 mb-3">{result.evidence.text}</p>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Page Number:</span>
                                <span className="ml-2 font-medium">{result.evidence.pageNumber}</span>
                              </div>
                              {result.evidence.confidence && (
                                <div>
                                  <span className="text-gray-600">Confidence:</span>
                                  <span className="ml-2 font-medium">
                                    {(result.evidence.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {result.reason && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <h4 className="font-medium text-sm text-blue-900 mb-2">Analysis</h4>
                              <p className="text-sm text-blue-800">{result.reason}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-600">Select an item from the list to view evidence details</p>
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

