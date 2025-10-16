# Implementation Guide - Document Verification System

## Overview

This document provides a comprehensive guide to the Document Verification System built with Next.js and Databricks API integration.

## Application Architecture

### Four-Page Workflow

1. **Page 1: API Key Configuration** (`/`)
   - Secure token input with validation
   - Session-based authentication
   - Automatic redirect on success

2. **Page 2: Main Dashboard** (`/dashboard`)
   - Split-screen layout (checklist + upload)
   - Drag-and-drop file upload
   - Real-time file validation

3. **Page 3: Processing** (`/processing`)
   - Server-Sent Events for real-time updates
   - Animated progress indicators
   - Sequential item verification

4. **Page 4: Verification Report** (`/report`)
   - Interactive results display
   - Evidence details viewer
   - Multi-format export (JSON, Excel, PDF)

## Key Features Implemented

### Security
- ✅ Encrypted session storage with iron-session
- ✅ HTTP-only cookies for token storage
- ✅ Server-side token validation
- ✅ No client-side token exposure
- ✅ File type and size validation

### UI/UX
- ✅ Responsive design (mobile-friendly)
- ✅ Framer Motion animations
- ✅ Loading states and error handling
- ✅ Toast notifications
- ✅ Accessible components (WCAG 2.1 AA)

### Functionality
- ✅ Document upload (PDF, DOCX, max 10MB)
- ✅ Real-time processing with SSE
- ✅ Checklist verification
- ✅ Evidence extraction
- ✅ Report generation
- ✅ Multiple export formats

## Databricks Integration

### Current Implementation (Simulated)

The application includes a simulated Databricks API for demonstration:

```typescript
// Location: app/api/process/route.ts
async function callDatabricksAPI(token, documentPath, checklistItem) {
  // Simulates API call with random results
  // Replace with actual Databricks integration
}
```

### Production Integration Options

#### Option 1: SQL Warehouse

```typescript
const response = await fetch(
  `${process.env.DATABRICKS_HOST}/api/2.0/sql/statements`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      warehouse_id: process.env.DATABRICKS_WAREHOUSE_ID,
      statement: `SELECT verify_document('${documentPath}', '${criteria}')`,
    }),
  }
);
```

#### Option 2: ML Model Serving Endpoint

```typescript
const response = await fetch(
  `${process.env.DATABRICKS_HOST}/serving-endpoints/document-verifier/invocations`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dataframe_records: [{
        document_path: documentPath,
        criteria: checklistItem.criteria,
      }],
    }),
  }
);
```

#### Option 3: Jobs API

```typescript
const response = await fetch(
  `${process.env.DATABRICKS_HOST}/api/2.1/jobs/run-now`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job_id: process.env.DATABRICKS_JOB_ID,
      notebook_params: {
        document_path: documentPath,
        checklist: JSON.stringify(checklist),
      },
    }),
  }
);
```

## File Structure

```
document_checker/
├── app/
│   ├── api/                    # API Routes
│   │   ├── validate-token/     # POST: Validate Databricks token
│   │   ├── checklist/          # GET: Fetch checklist data
│   │   ├── upload/             # POST: Upload document
│   │   ├── process/            # POST/GET: Process document (SSE)
│   │   └── export/             # POST: Export report
│   ├── dashboard/              # Page 2: Main dashboard
│   ├── processing/             # Page 3: Processing page
│   ├── report/                 # Page 4: Verification report
│   ├── layout.tsx              # Root layout with Toaster
│   ├── page.tsx                # Page 1: API key configuration
│   └── globals.css             # Global styles with CSS variables
├── components/
│   └── ui/                     # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── toast.tsx
│       └── toaster.tsx
├── lib/
│   ├── checklist-data.ts       # Default checklist configuration
│   ├── session.ts              # Session management utilities
│   └── utils.ts                # Utility functions (cn)
├── store/
│   └── useDocumentStore.ts     # Zustand state management
├── types/
│   └── index.ts                # TypeScript type definitions
├── hooks/
│   └── use-toast.ts            # Toast notification hook
├── .env.local                  # Environment variables
├── tailwind.config.ts          # Tailwind configuration
└── README.md                   # Project documentation
```

## Environment Variables

Required variables in `.env.local`:

```env
# Databricks Configuration
DATABRICKS_HOST=https://your-instance.cloud.databricks.com
DATABRICKS_TOKEN=dapi... (optional, for server-side operations)

# Session Secret (required)
SESSION_SECRET=your-secret-key-at-least-32-characters-long

# Optional: Warehouse/Job IDs for production
DATABRICKS_WAREHOUSE_ID=your-warehouse-id
DATABRICKS_JOB_ID=your-job-id
```

## Customization Guide

### Modifying the Checklist

Edit `lib/checklist-data.ts`:

```typescript
export const defaultChecklist: ChecklistItem[] = [
  {
    id: 1,
    description: 'Your Custom Item',
    criteria: 'Verification criteria description',
    status: 'pending',
  },
  // Add more items...
];
```

### Changing Colors

Edit `app/globals.css` CSS variables:

```css
:root {
  --primary: 217.2 91.2% 59.8%;  /* Blue - change to your brand color */
  --destructive: 0 84.2% 60.2%;  /* Red */
  /* ... other colors */
}
```

### Adding New Export Formats

Edit `app/api/export/route.ts` and add new case:

```typescript
case 'csv':
  // Implement CSV export logic
  break;
```

## Testing the Application

### Manual Testing Steps

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test Page 1 (API Key):**
   - Navigate to http://localhost:3000
   - Enter a test token (min 10 characters)
   - Verify validation and redirect

3. **Test Page 2 (Dashboard):**
   - Upload a test PDF or DOCX file
   - Verify file validation (size, type)
   - Click "Process Document"

4. **Test Page 3 (Processing):**
   - Watch real-time progress updates
   - Verify animated status changes
   - Wait for automatic redirect

5. **Test Page 4 (Report):**
   - Review summary statistics
   - Click on checklist items
   - Test export functionality

### API Testing

Use curl or Postman to test API endpoints:

```bash
# Validate token
curl -X POST http://localhost:3000/api/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"test-token-12345"}'

# Get checklist
curl http://localhost:3000/api/checklist

# Upload file
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test-document.pdf"
```

## Performance Considerations

- **Code Splitting**: Automatic with Next.js App Router
- **Server Components**: Used for static content
- **Client Components**: Only for interactive elements
- **Image Optimization**: Use Next.js Image component
- **Bundle Size**: Monitor with `npm run build`

## Accessibility Features

- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ ARIA labels on all interactive elements
- ✅ Focus indicators visible
- ✅ Color contrast ≥ 4.5:1
- ✅ Screen reader support
- ✅ Semantic HTML structure

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **"Unauthorized" error**
   - Check Databricks token validity
   - Verify SESSION_SECRET is set

2. **File upload fails**
   - Check file size (max 10MB)
   - Verify file type (PDF/DOCX only)
   - Check uploads directory permissions

3. **Processing stuck**
   - Check browser console for errors
   - Verify SSE connection
   - Check API route logs

4. **Export not working**
   - Verify report data exists
   - Check browser download settings
   - Review API route logs

## Future Enhancements

- [ ] Real PDF viewer with react-pdf
- [ ] Batch document processing
- [ ] Custom checklist templates
- [ ] User authentication system
- [ ] Advanced analytics dashboard
- [ ] Email notifications
- [ ] Audit trail
- [ ] Multi-language support
- [ ] Dark mode toggle
- [ ] Mobile app (React Native)

## Support

For issues or questions:
- Check the README.md
- Review this implementation guide
- Check browser console for errors
- Review server logs

## License

MIT License - Free to use and modify

