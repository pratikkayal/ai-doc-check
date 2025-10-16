'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import NextDynamic from 'next/dynamic';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { VerificationReport, VerificationResult, TokenEvidenceAnchor } from '@/types';

const PDFDocument: any = NextDynamic(async () => (await import('react-pdf')).Document, { ssr: false });
const PDFPage: any = NextDynamic(async () => (await import('react-pdf')).Page, { ssr: false });

export default function ReportViewerPage() {
  const router = useRouter();
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfOk, setPdfOk] = useState<boolean | null>(null);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const [workerReady, setWorkerReady] = useState(false);

  const [report, setReport] = useState<VerificationReport | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Array<{left:number;top:number;width:number;height:number}>>([]);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const pdfFile = useMemo(() => (pdfUrl ? { url: pdfUrl, withCredentials: true } : undefined), [pdfUrl]);

  useEffect(() => {
    // Load report from session storage
    const reportData = sessionStorage.getItem('verificationReport');
    if (reportData) {
      const parsedReport = JSON.parse(reportData);
      setReport(parsedReport);

      // Set PDF URL from document path or name
      let filename: string | undefined;
      if (parsedReport.documentPath) {
        filename = parsedReport.documentPath.split('/').pop();
      } else if (parsedReport.documentName) {
        filename = parsedReport.documentName;
      }
      if (filename) {
        const url = `/api/serve-pdf?filename=${encodeURIComponent(filename)}`;
        console.info('PDF URL set:', url);
        setPdfUrl(url);
        fetch(url, { method: 'HEAD' })
          .then(res => { setPdfOk(res.ok); setPdfErr(res.ok ? null : `${res.status} ${res.statusText}`); console.info('PDF HEAD check', res.status, res.statusText); })
          .catch(err => { setPdfOk(false); setPdfErr(String(err)); console.warn('PDF HEAD error', err); });
      }
    }

  }, []);

  // Configure PDF.js worker on client (bundle-served, no CDN)
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('react-pdf');
        mod.pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        setWorkerReady(true);
      } catch {
        try {
          const mod = await import('react-pdf');
          mod.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          setWorkerReady(true);
        } catch (e) {
          console.error('Failed to configure PDF.js worker', e);
          setWorkerReady(false);
        }
      }
    })();
  }, []);

  // Watchdog: if PDF stays in loading state too long (no pdfDoc, no error), force a reload
  useEffect(() => {
    if (!pdfUrl || !workerReady) return;
    const id = setTimeout(() => {
      if (!pdfDoc && pdfErr == null && pdfOk !== false) {
        console.warn('PDF took too long to load, retrying...');
        setReloadKey((k) => k + 1);
      }
    }, 15000);
    return () => clearTimeout(id);
  }, [pdfUrl, workerReady, pdfDoc, pdfErr, pdfOk]);


  const onDocumentLoadSuccess = (pdf: any) => {
    try {
      setPdfDoc(pdf);
      setNumPages(pdf?.numPages || 0);
      console.info('PDF loaded:', { pages: pdf?.numPages });
    } catch {}
  };

  const handleItemClick = async (result: VerificationResult) => {
    setSelectedItemId(result.itemId);
    const anchors = (result.evidence?.tokens || []) as TokenEvidenceAnchor[];
    const target = anchors.find(a => typeof a.pageNumber === 'number');
    if (target?.pageNumber) {
      setCurrentPage(target.pageNumber);
    } else if (pdfDoc && anchors.length && numPages > 0) {
      // Try to find the first page that matches any token anchor
      const page = await findPageForTokens(anchors);
      if (page) setCurrentPage(page);
    }
    setTimeout(() => updateHighlightsForCurrentPage(), 200);
  };

  async function findPageForTokens(anchors: TokenEvidenceAnchor[]): Promise<number | null> {
    try {
      const startPhrases = anchors.map(a => (a.startTokens || []).join(' ').toLowerCase()).filter(Boolean);
      const endPhrases = anchors.map(a => (a.endTokens || []).join(' ').toLowerCase()).filter(Boolean);
      if (!startPhrases.length || !endPhrases.length) return null;
      // Scan pages sequentially; optimize later if needed
      for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        const combined = (content.items || []).map((it:any)=>String(it.str||'')).join(' ').toLowerCase();
        let matched = false;
        for (let i = 0; i < startPhrases.length; i++) {
          const s = startPhrases[i];
          const e = endPhrases[i] || endPhrases[0];
          const si = combined.indexOf(s);
          if (si >= 0) {
            const ei = combined.indexOf(e, si + s.length);
            if (ei >= 0) { matched = true; break; }
          }
        }
        if (matched) return p;
      }
      return null;
    } catch (e) {
      console.warn('findPageForTokens error', e); return null;
    }
  }

  const handlePreviousPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min(numPages, p + 1));
  const handleZoomIn = () => setScale(s => Math.min(3.0, s + 0.2));
  const handleZoomOut = () => setScale(s => Math.max(0.5, s - 0.2));
  // Recompute highlights when page or selection changes
  useEffect(() => {
    const t = setTimeout(() => updateHighlightsForCurrentPage(), 250);
    return () => clearTimeout(t);
  }, [currentPage, selectedItemId, scale]);

  function updateHighlightsForCurrentPage() {
    try {
      if (!report) return setHighlights([]);
      const selected = report.results.find(r => r.itemId === selectedItemId);
      const anchors: TokenEvidenceAnchor[] = (selected?.evidence?.tokens || []) as TokenEvidenceAnchor[];
      const pageEl = pageContainerRef.current as HTMLElement | null;
      if (!pageEl || !anchors.length) { setHighlights([]); return; }
      const textLayer = pageEl.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) { setHighlights([]); return; }
      const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
      if (!spans.length) { setHighlights([]); return; }

      // Build page text and mapping indices to spans
      let offset = 0;
      const mapping = spans.map((el) => {
        const text = (el.textContent || '');
        const start = offset;
        const end = start + text.length;
        offset = end + 1; // plus separator space
        return { el, text, start, end };
      });
      const pageText = mapping.map(m => m.text).join(' ').toLowerCase();

      const rects: Array<{left:number;top:number;width:number;height:number}> = [];
      anchors.forEach(a => {
        if (a.pageNumber && a.pageNumber !== currentPage) return;
        const startPhrase = (a.startTokens || []).join(' ').toLowerCase();
        const endPhrase = (a.endTokens || []).join(' ').toLowerCase();
        if (!startPhrase || !endPhrase) return;
        let from = 0;
        while (true) {
          const sIdx = pageText.indexOf(startPhrase, from);
          if (sIdx === -1) break;
          const eIdx = pageText.indexOf(endPhrase, sIdx + startPhrase.length);
          if (eIdx === -1) { from = sIdx + 1; continue; }
          const matchStart = sIdx;
          const matchEnd = eIdx + endPhrase.length;
          // Map to span rects for this occurrence
          mapping.forEach(m => {
            if (m.end <= matchStart || m.start >= matchEnd) return;
            const r = m.el.getBoundingClientRect();
            const c = (pageEl as HTMLElement).getBoundingClientRect();
            rects.push({ left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height });
          });
          from = sIdx + 1; // continue searching for additional occurrences
        }
      });
      setHighlights(rects);
    } catch (e) {
      console.warn('Failed to compute highlights:', e);
      setHighlights([]);
    }
  }



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
                        {Array.isArray(result.evidence.tokens) && result.evidence.tokens.length > 0 && (
                          <span>{result.evidence.tokens.length} evidence segment(s)</span>
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

        {/* Right Panel - PDF Viewer */}
        <div className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
          {/* PDF Controls */}
          <div className="bg-white border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Page {currentPage} of {numPages}</span>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= numPages}>
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
          <div className="flex-1 overflow-auto p-8 flex flex-col items-center gap-3">
            {pdfErr && (
              <div className="w-full max-w-3xl px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded">
                Failed to load PDF: {pdfErr}. If this report references an old upload, please re-upload/process, then open Interactive View again.
              </div>
            )}
            {pdfOk === false && !pdfErr && (
              <div className="w-full max-w-3xl px-4 py-2 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded">
                PDF file not found on server. It may have been cleaned up or the name changed. Re-upload and re-process the document to refresh the link.
              </div>
            )}
            {pdfUrl && workerReady ? (
              <div className="relative bg-white shadow-lg">
                <PDFDocument key={`${pdfUrl}-${reloadKey}`} file={pdfFile as any} onLoadSuccess={onDocumentLoadSuccess} onLoadError={(e:any)=>{ console.error('PDF load error', e); setPdfErr(String(e)); }} loading={<div className="p-8">Loading PDF...</div>}>
                  <div className="relative" ref={pageContainerRef}>
                    <PDFPage pageNumber={currentPage} scale={scale} renderTextLayer={true} renderAnnotationLayer={true} onRenderSuccess={() => updateHighlightsForCurrentPage()} />
                    {/* Highlight overlays for current page */}
                    {highlights.map((rect, idx) => (
                      <div
                        key={idx}
                        className={`absolute border-2 ${selectedItemId ? 'border-blue-500 bg-blue-200/30' : 'border-yellow-500 bg-yellow-200/30'} transition-all`}
                        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                      />
                    ))}
                  </div>
                </PDFDocument>
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

