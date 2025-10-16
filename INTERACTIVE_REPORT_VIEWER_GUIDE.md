# Interactive Report Viewer Guide

## Overview

The Interactive Report Viewer is a new feature (Page 5) that provides a side-by-side view of the verification checklist and the original PDF document with visual highlights for verified/failed sections.

---

## Features

### 1. **Split-Screen Layout**
- **Left Panel:** Verification checklist with all items and their status
- **Right Panel:** PDF document viewer with zoom, pan, and navigation controls

### 2. **PDF Text Extraction**
- Text is extracted from PDF documents during upload
- Extracted text is saved as a `.txt` file for efficient reuse
- No need to re-read the PDF binary during verification

### 3. **Visual Highlights**
- Green highlights for verified items
- Red highlights for failed items
- Highlights are positioned using evidence coordinates (x, y, width, height)
- Click on highlights to see corresponding checklist item

### 4. **Scroll Synchronization**
- Click on a checklist item → PDF viewer navigates to the relevant page
- Navigate to a page → Corresponding checklist item is auto-selected
- Bidirectional linking for seamless navigation

### 5. **PDF Viewer Controls**
- **Zoom:** Zoom in/out (50% to 300%)
- **Navigation:** Previous/Next page buttons
- **Page Counter:** Shows current page and total pages
- **Responsive:** Works on desktop and tablet devices

---

## Implementation Details

### Files Created

1. **`app/report-viewer/page.tsx`** - Main interactive report viewer page
2. **`app/api/serve-pdf/route.ts`** - API route to serve PDF files securely
3. **`lib/pdf-utils.ts`** - Utility functions for PDF text extraction

### Files Modified

1. **`types/index.ts`** - Added `path` and `extractedText` to `DocumentMetadata`, added `documentPath` to `VerificationReport`
2. **`app/api/upload/route.ts`** - Added PDF text extraction during upload
3. **`app/api/process/route.ts`** - Updated to use extracted text file, added `documentPath` to response
4. **`app/report/page.tsx`** - Added "Interactive View" button to navigate to the new viewer

### Dependencies Installed

```bash
npm install react-pdf react-intersection-observer pdf-parse pdfjs-dist
```

---

## Usage

### For Users

1. **Upload a document** on the dashboard (Page 2)
2. **Process the document** - text is automatically extracted
3. **View the report** on the report page (Page 4)
4. **Click "Interactive View"** button to open the interactive viewer
5. **Navigate** between checklist items and PDF pages
6. **Click on highlights** to see evidence details

### For Developers

#### Accessing the Interactive Viewer

```typescript
// From the report page
sessionStorage.setItem('verificationReport', JSON.stringify(report));
router.push('/report-viewer');
```

#### PDF Text Extraction

```typescript
import { extractDocumentText } from '@/lib/pdf-utils';

// Extract text from PDF
const text = await extractDocumentText(filepath, 'application/pdf');

// Text is saved as {filename}.txt
await writeFile(`${filepath}.txt`, text, 'utf-8');
```

#### Serving PDF Files

```typescript
// API route: /api/serve-pdf?filename=document.pdf
// Returns PDF file with proper headers
```

---

## Architecture

### Data Flow

```
1. Upload Document (Page 2)
   ↓
2. Extract PDF Text → Save as .txt file
   ↓
3. Process Document (Page 3)
   ↓
4. Use extracted text for LLM verification
   ↓
5. Generate Report with coordinates (Page 4)
   ↓
6. Interactive Viewer (Page 5)
   - Load PDF from server
   - Overlay highlights using coordinates
   - Sync checklist with PDF pages
```

### Component Structure

```
ReportViewerPage
├── Header (Back button, title, summary badge)
├── Split Screen Container
│   ├── Left Panel (Checklist)
│   │   └── Checklist Items (clickable cards)
│   └── Right Panel (PDF Viewer)
│       ├── PDF Controls (zoom, navigation)
│       └── PDF Document
│           ├── PDF Page (react-pdf)
│           └── Highlight Overlays (positioned divs)
```

---

## Technical Details

### PDF Rendering

Uses `react-pdf` library with `pdfjs-dist` worker:

```typescript
import { Document, Page, pdfjs } from 'react-pdf';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = 
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Render PDF
<Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
  <Page pageNumber={currentPage} scale={scale} />
</Document>
```

### Highlight Positioning

Highlights are positioned using absolute positioning based on evidence coordinates:

```typescript
<div
  className="absolute border-2 border-green-500 bg-green-200/30"
  style={{
    left: `${coords.x * scale}px`,
    top: `${coords.y * scale}px`,
    width: `${coords.width * scale}px`,
    height: `${coords.height * scale}px`,
  }}
/>
```

### Scroll Synchronization

```typescript
// When checklist item is clicked
const handleItemClick = (result: VerificationResult) => {
  setSelectedItemId(result.itemId);
  setCurrentPage(result.evidence.pageNumber);
};

// When page changes
useEffect(() => {
  const resultOnPage = report.results.find(
    (r) => r.evidence.pageNumber === currentPage
  );
  if (resultOnPage) {
    setSelectedItemId(resultOnPage.itemId);
  }
}, [currentPage]);
```

---

## Security

### PDF File Access

- PDF files are served through a secure API route (`/api/serve-pdf`)
- Authentication is required to access PDF files
- Directory traversal attacks are prevented
- Only files in the `uploads` directory can be accessed

```typescript
// Security checks in serve-pdf route
if (filename.includes('..') || filename.includes('/')) {
  return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
}
```

---

## Performance Optimizations

### 1. **Text Extraction During Upload**
- Text is extracted once during upload
- Saved as a separate `.txt` file
- Reused during verification (no need to re-read PDF)

### 2. **Lazy Loading**
- PDF pages are loaded on-demand
- Only the current page is rendered
- Reduces memory usage for large PDFs

### 3. **Efficient Highlighting**
- Highlights are only rendered for the current page
- Uses CSS transforms for smooth animations
- Minimal DOM manipulation

### 4. **Session Storage**
- Report data is stored in session storage
- Avoids unnecessary API calls
- Fast page transitions

---

## Responsive Design

### Desktop (>1024px)
- Side-by-side layout
- Checklist: 33% width
- PDF Viewer: 67% width

### Tablet (768px - 1024px)
- Side-by-side layout (narrower)
- Checklist: 40% width
- PDF Viewer: 60% width

### Mobile (<768px)
- **Note:** Current implementation is optimized for desktop/tablet
- For mobile, consider stacking panels vertically or using tabs

---

## Future Enhancements

### Planned Features

1. **Search in PDF**
   - Full-text search across the document
   - Highlight search results

2. **Annotations**
   - Allow users to add notes to highlights
   - Save annotations with the report

3. **Multi-Page Highlights**
   - Support evidence spanning multiple pages
   - Show connected highlights

4. **Export with Highlights**
   - Export PDF with highlights embedded
   - Include annotations in export

5. **Mobile Optimization**
   - Responsive layout for mobile devices
   - Touch gestures for zoom/pan

6. **Thumbnail Navigation**
   - Show page thumbnails in sidebar
   - Quick navigation to any page

---

## Troubleshooting

### Issue: PDF Not Loading

**Cause:** PDF file path is incorrect or file doesn't exist

**Solution:**
1. Check that `documentPath` is included in the report
2. Verify the file exists in the `uploads` directory
3. Check browser console for errors

### Issue: Highlights Not Showing

**Cause:** Evidence coordinates are missing or invalid

**Solution:**
1. Ensure verification results include `coordinates` in evidence
2. Check that coordinates are valid (x, y, width, height)
3. Verify the page number matches the current page

### Issue: Text Extraction Fails

**Cause:** PDF is encrypted or corrupted

**Solution:**
1. Check PDF file integrity
2. Ensure PDF is not password-protected
3. Try re-uploading the document

### Issue: Slow Performance

**Cause:** Large PDF file or many highlights

**Solution:**
1. Reduce PDF file size before upload
2. Limit the number of checklist items
3. Use pagination for large documents

---

## API Reference

### GET /api/serve-pdf

Serves a PDF file from the uploads directory.

**Query Parameters:**
- `filename` (required): Name of the PDF file

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `inline; filename="..."`

**Example:**
```typescript
const pdfUrl = `/api/serve-pdf?filename=${filename}`;
```

---

## Code Examples

### Navigating to Interactive Viewer

```typescript
// From any page with access to the report
const navigateToInteractiveViewer = (report: VerificationReport) => {
  sessionStorage.setItem('verificationReport', JSON.stringify(report));
  router.push('/report-viewer');
};
```

### Extracting Text from PDF

```typescript
import { extractPDFText } from '@/lib/pdf-utils';

const text = await extractPDFText('/path/to/document.pdf');
console.log(`Extracted ${text.length} characters`);
```

### Adding Custom Highlights

```typescript
// In the report viewer component
const customHighlights = [
  {
    pageNumber: 1,
    coordinates: { x: 100, y: 200, width: 300, height: 50 },
    color: 'blue',
    label: 'Custom highlight'
  }
];
```

---

## Summary

The Interactive Report Viewer provides a powerful way to visualize verification results alongside the original document. Key benefits include:

✅ **Efficient Text Extraction** - Extract once, use multiple times  
✅ **Visual Feedback** - See exactly where evidence was found  
✅ **Seamless Navigation** - Click to jump between checklist and document  
✅ **Professional UI** - Clean, modern interface with smooth animations  
✅ **Secure Access** - Authentication required, directory traversal prevented  

For more information, see the implementation files or contact the development team.

