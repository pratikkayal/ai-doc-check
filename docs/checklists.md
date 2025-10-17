# Checklist Management (Dynamic, User-Configurable)

This app supports a general-purpose, dynamic document compliance checklist system. You can create, select, edit, and preview checklists that drive the verification process and appear in the report and interactive viewer.

## Key Concepts
- Checklist: A named set of verification items (description + criteria) used to validate a document.
- Templates Directory: JSON files stored under `/checklists/` persist your checklists on disk.
- Presets (auto-created on first run):
  - Small Resume Checklist (3 items)
  - Full Resume Checklist (8 items)

## Create a Checklist (Manual)
1. Navigate to `/checklists/new`.
2. Enter Name and Description.
3. Add items with Description and Criteria. Use “Add Item” to add more rows.
4. Click “Save Checklist”. You will be redirected to the dashboard.

Your new checklist is saved as a JSON file in `/checklists/` and immediately available as a template.

## Select a Checklist (Dashboard)
On `/dashboard`:
- Step 1 shows a grid of checklist cards. Each card displays name, description, item count, and created date.
- Click “Select” on a card to set it as the active checklist.
- “Edit” opens `/checklists/edit/[id]` (coming soon);
- “Preview” loads and shows items in the left panel.

Notes:
- Upload/processing is disabled until a checklist is selected. The selected checklist flows into the processing API and report.

## Process a Document
1. After selecting a checklist, upload your document (PDF) in Step 2.
2. Click “Process Document”.
3. The app connects to `/api/process` (SSE) with `checklistId`, runs verification, and navigates to `/report`.

## Report and Viewer
- The report shows checklist metadata (name, description) and the verification summary and results.
- Click “Interactive View” to open `/report-viewer` where the same checklist metadata appears above the split-screen viewer.

## Where Data Lives
- Files you upload: `/uploads/`
- Checklists you create: `/checklists/*.json`

## API Endpoints
- `GET /api/checklists` – list templates with metadata
- `POST /api/checklists` – create checklist
- `GET /api/checklists/[id]` – fetch checklist by id
- `GET /api/process?filename&documentPath&checklistId` – SSE processing with selected checklist
- `POST /api/process { filename, documentPath, checklistId }` – non-SSE processing

## Databricks LLM (for AI-generated checklists)
- The token is read from your session. In development you can use `.env.local` to store `DATABRICKS_TOKEN` and log in via the app’s token form.
- The app uses the Databricks LLM for verification and, in Phase 1 Step 2, for generating checklist drafts from reference documents (UI coming next).

Security note: Do not commit real tokens. The provided sample token in `.env.local` is for local development only.

## Troubleshooting
- If report shows wrong checklist: ensure a checklist is selected before processing, and that the URL contains `checklistId`.
- If PDF viewer gets stuck: the server has HTTP Range support and a watchdog retry; check server logs under `/api/serve-pdf` for 206/200 responses and fallback resolution.
- If templates don’t appear: verify the `/checklists/` folder is writable by the app.

