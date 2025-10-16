'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { VerificationReport, VerificationResult, TextEvidenceRange } from '@/types';


export default function ReportViewerPage() {
  const router = useRouter();
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const textViewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load report from session storage
    const reportData = sessionStorage.getItem('verificationReport');
    if (reportData) {
      const parsedReport = JSON.parse(reportData);
      setReport(parsedReport);

      // Fetch extracted document text by filename
      let filename: string | undefined;
      if (parsedReport.documentPath) {
        filename = parsedReport.documentPath.split('/').pop();
      } else if (parsedReport.documentName) {
        filename = parsedReport.documentName;
      }
      if (filename) {
        fetch(`/api/get-text?filename=${encodeURIComponent(filename)}`)
          .then(async (res) => (res.ok ? res.text() : ''))
          .then((txt) => setDocumentText(txt || ''))
          .catch(() => setDocumentText(''));
      }
    }
  }, []);


  const handleItemClick = (result: VerificationResult) => {
    setSelectedItemId(result.itemId);
    // Scroll the text viewer to the first highlight (if any)
    setTimeout(() => {
      const container = textViewerRef.current || document;
      const first = container.querySelector('#first-highlight') as HTMLElement | null;
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Render the document text with highlighted evidence ranges
  const renderHighlightedText = (
    text: string,
    ranges?: TextEvidenceRange[]
  ) => {
    if (!ranges || ranges.length === 0) {
      return <pre className="whitespace-pre-wrap break-words">{text}</pre>;
    }

    // Normalize and merge overlapping ranges
    const sorted = [...ranges]
      .map(r => ({ start: Math.max(0, r.start), end: Math.min(text.length, r.end) }))
      .filter(r => r.end > r.start)
      .sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    for (const r of sorted) {
      if (!merged.length || r.start > merged[merged.length - 1].end) {
        merged.push({ start: r.start, end: r.end });
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
      }
    }

    const nodes: React.ReactNode[] = [];
    let last = 0;
    merged.forEach((r, idx) => {
      if (r.start > last) {
        nodes.push(<span key={`t-${idx}`}>{text.substring(last, r.start)}</span>);
      }
      nodes.push(
        <mark key={`h-${idx}`} id={idx === 0 ? 'first-highlight' : undefined} className="bg-yellow-200 rounded px-0.5">
          {text.substring(r.start, r.end)}
        </mark>
      );
      last = r.end;
    });
    if (last < text.length) {
      nodes.push(<span key="t-end">{text.substring(last)}</span>);
    }

    return <pre className="whitespace-pre-wrap break-words">{nodes}</pre>;
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
                        {Array.isArray(result.evidence.ranges) && result.evidence.ranges.length > 0 && (
                          <span>{result.evidence.ranges.length} evidence segment(s)</span>
                        )}
                        {typeof result.evidence.confidence === 'number' && (
                          <span>Confidence: {(result.evidence.confidence * 100).toFixed(0)}%</span>
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

        {/* Right Panel - Text Viewer */}
        <div className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
          <div className="bg-white border-b p-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {documentText ? (
                <span>Showing extracted text ({documentText.length.toLocaleString()} chars)</span>
              ) : (
                <span>Loading text…</span>
              )}
            </div>
          </div>

          <div ref={textViewerRef} className="flex-1 overflow-auto p-6">
            <div className="bg-white shadow rounded p-6">
              {renderHighlightedText(
                documentText,
                report.results.find(r => r.itemId === selectedItemId)?.evidence.ranges
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

