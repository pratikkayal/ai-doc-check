import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
import { VerificationReport } from '@/types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { report, format } = await request.json() as { report: VerificationReport; format: 'json' | 'excel' | 'pdf' };

    if (!report || !format) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    switch (format) {
      case 'json':
        return NextResponse.json(report, {
          headers: {
            'Content-Disposition': `attachment; filename="verification-report-${Date.now()}.json"`,
          },
        });

      case 'excel':
        // Create Excel workbook
        const workbook = XLSX.utils.book_new();
        
        // Summary sheet
        const summaryData = [
          ['Document Verification Report'],
          [''],
          ['Document Name', report.documentName],
          ['Upload Date', new Date(report.uploadDate).toLocaleString()],
          ['Processing Date', new Date(report.processingDate).toLocaleString()],
          [''],
          ['Summary'],
          ['Total Items', report.summary.total],
          ['Passed', report.summary.passed],
          ['Failed', report.summary.failed],
          ['Success Rate', `${report.summary.successRate.toFixed(2)}%`],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

        // Results sheet
        const resultsData = [
          ['Item ID', 'Status', 'Evidence Text', 'Page Number', 'Confidence', 'Reason'],
          ...report.results.map(r => [
            r.itemId,
            r.status,
            r.evidence.text,
            r.evidence.pageNumber,
            r.evidence.confidence ? `${(r.evidence.confidence * 100).toFixed(2)}%` : 'N/A',
            r.reason || '',
          ]),
        ];
        const resultsSheet = XLSX.utils.aoa_to_sheet(resultsData);
        XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Results');

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="verification-report-${Date.now()}.xlsx"`,
          },
        });

      case 'pdf':
        // Generate PDF using jsPDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;

        // Helper function to add text with word wrap
        const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
          doc.setFontSize(fontSize);
          if (isBold) {
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setFont('helvetica', 'normal');
          }

          const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
          lines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(line, margin, yPosition);
            yPosition += fontSize * 0.5;
          });
          yPosition += 3;
        };

        // Title
        addText('Document Verification Report', 20, true);
        yPosition += 5;

        // Document Information
        addText('Document Information', 14, true);
        addText(`Document Name: ${report.documentName}`);
        addText(`Upload Date: ${new Date(report.uploadDate).toLocaleString()}`);
        addText(`Processing Date: ${new Date(report.processingDate).toLocaleString()}`);
        yPosition += 5;

        // Summary
        addText('Summary', 14, true);
        addText(`Total Items: ${report.summary.total}`);
        addText(`Passed: ${report.summary.passed}`);
        addText(`Failed: ${report.summary.failed}`);
        addText(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
        yPosition += 5;

        // Results
        addText('Verification Results', 14, true);
        yPosition += 2;

        report.results.forEach((result, index) => {
          // Check if we need a new page
          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = margin;
          }

          addText(`Item ${result.itemId}`, 12, true);
          addText(`Status: ${result.status.toUpperCase()}`);
          addText(`Evidence: ${result.evidence.text}`);
          addText(`Page Number: ${result.evidence.pageNumber}`);
          if (result.evidence.confidence) {
            addText(`Confidence: ${(result.evidence.confidence * 100).toFixed(2)}%`);
          }
          if (result.reason) {
            addText(`Reason: ${result.reason}`);
          }

          // Add separator line
          if (index < report.results.length - 1) {
            yPosition += 2;
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 5;
          }
        });

        // Generate PDF buffer
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="verification-report-${Date.now()}.pdf"`,
          },
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid format' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export report' },
      { status: 500 }
    );
  }
}

