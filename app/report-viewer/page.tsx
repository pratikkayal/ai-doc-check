'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
const Document = dynamic(() => import('react-pdf').then(m => m.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(m => m.Page), { ssr: false });
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { VerificationReport, VerificationResult } from '@/types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';


export default function ReportViewerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const documentViewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load report from session storage
    const reportData = sessionStorage.getItem('verificationReport');
    if (reportData) {
      const parsedReport = JSON.parse(reportData);
      setReport(parsedReport);

      // Set PDF URL from document path or fall back to document name
      let filename: string | undefined;
      if (parsedReport.documentPath) {
        filename = parsedReport.documentPath.split('/').pop();
      } else if (parsedReport.documentName) {
        filename = parsedReport.documentName;
      }
      if (filename) {
        setPdfUrl(`/api/serve-pdf?filename=${encodeURIComponent(filename)}`);
      }
    }
  }, []);

  // Configure PDF.js worker on client only (bundle-served, no CDN)
  useEffect(() => {
    (async () => {
      const { pdfjs } = await import('react-pdf');
      try {
        // Prefer ESM worker (pdf.js v5+)
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      } catch (e) {
        try {
          // Fallback to JS worker if needed
          pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
        } catch {
          // Last resort: static path (requires public/pdf.worker.min.mjs)
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }
      }
    })();
  }, []);

  // Auto-select checklist item when page changes
  useEffect(() => {
    if (report && currentPage) {
      // Find the first result on the current page
      const resultOnPage = report.results.find(
        (r) => r.evidence.pageNumber === currentPage

      );
      if (resultOnPage && selectedItemId !== resultOnPage.itemId) {
        setSelectedItemId(resultOnPage.itemId);
      }
    }
  }, [currentPage, report]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));

  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  const handleItemClick = (result: VerificationResult) => {
    setSelectedItemId(result.itemId);
    // Navigate to the page where evidence was found
    if (result.evidence.pageNumber) {
      setCurrentPage(result.evidence.pageNumber);
      // Scroll the document viewer to show the highlight
      setTimeout(() => {
        if (documentViewerRef.current) {
          documentViewerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const getStatusColor = (status: 'verified' | 'failed') => {
    return status === 'verified' ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusBadgeVariant = (status: 'verified' | 'failed') => {
    return status === 'verified' ? 'default' : 'destructive';
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-lg">Loading report...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/report')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Report
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Interactive Report Viewer
                </h1>
                <p className="text-sm text-gray-600">{report.documentName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={report.summary.successRate >= 70 ? 'default' : 'destructive'}>
                {report.summary.passed}/{report.summary.total} Passed
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Split Screen */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Checklist */}
        <div className="w-1/3 bg-white border-r overflow-y-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Verification Checklist</h2>
            <div className="space-y-3">
              {report.results.map((result) => (
                <Card
                  key={result.itemId}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedItemId === result.itemId
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : ''
                  }`}
                  onClick={() => handleItemClick(result)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(
                        result.status
                      )}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          Item {result.itemId}
                        </span>
                        <Badge variant={getStatusBadgeVariant(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        {result.evidence.text}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Page {result.evidence.pageNumber}</span>
                        {result.evidence.confidence && (
                          <span>
                            Confidence: {(result.evidence.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {result.reason && (
                        <p className="text-xs text-gray-600 mt-2 italic">
                          {result.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - PDF Viewer */}
        <div className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
          {/* PDF Controls */}
          <div className="bg-white border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                Page {currentPage} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* PDF Document */}
          <div
            ref={documentViewerRef}
            className="flex-1 overflow-auto p-8 flex justify-center"
          >
            {pdfUrl ? (
              <div className="relative bg-white shadow-lg">
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <p>Loading PDF...</p>
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center p-8">
                      <p className="text-red-600">Failed to load PDF</p>
                    </div>
                  }
                >
                  <div className="relative">
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                    {/* Highlight overlays for current page */}
                    {report.results
                      .filter((r) => r.evidence.pageNumber === currentPage)
                      .map((result) => {
                        if (!result.evidence.coordinates) return null;
                        const coords = result.evidence.coordinates;
                        return (
                          <div
                            key={result.itemId}
                            className={`absolute border-2 ${
                              result.status === 'verified'
                                ? 'border-green-500 bg-green-200/30'
                                : 'border-red-500 bg-red-200/30'
                            } ${
                              selectedItemId === result.itemId
                                ? 'ring-4 ring-blue-400'
                                : ''
                            } cursor-pointer transition-all hover:opacity-80`}
                            style={{
                              left: `${coords.x * scale}px`,
                              top: `${coords.y * scale}px`,
                              width: `${coords.width * scale}px`,
                              height: `${coords.height * scale}px`,
                            }}
                            onClick={() => setSelectedItemId(result.itemId)}
                            title={`Item ${result.itemId}: ${result.evidence.text}`}
                          />
                        );
                      })}
                  </div>
                </Document>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <p className="text-gray-600">No PDF available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

