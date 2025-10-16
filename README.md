# Document Verification System

A comprehensive Next.js application that verifies uploaded documents against a predefined checklist using the Databricks API.

## Features

- **Dual API Modes**: Switch between simulated (testing) and real Databricks API calls
- **Secure Authentication**: Databricks Personal Access Token validation and secure session storage
- **Document Upload**: Drag-and-drop interface supporting PDF and DOCX files (up to 10MB)
- **Real-time Processing**: Live updates during document verification with animated UI
- **Interactive Reports**: Detailed verification results with evidence highlighting
- **Multiple Export Formats**: Download reports as JSON, Excel, or PDF
- **Responsive Design**: Mobile-friendly interface with modern UI components

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env.local`:
```env
# For development/testing (uses simulated API)
USE_REAL_API=false

# For production (uses real Databricks API via OpenAI-compatible endpoints)
# USE_REAL_API=true

# Databricks token (entered via login page)
DATABRICKS_TOKEN=

SESSION_SECRET=your-secret-key-at-least-32-characters-long
```

> **Note:** By default, the app uses simulated API responses for testing. Set `USE_REAL_API=true` to use real Databricks API calls via OpenAI-compatible serving endpoints. See [API_MODE_CONFIGURATION.md](./API_MODE_CONFIGURATION.md) for details.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Page 1**: Enter your Databricks Personal Access Token
2. **Page 2**: Upload a document (PDF/DOCX)
3. **Page 3**: Watch real-time verification progress
4. **Page 4**: View results and export reports

## Tech Stack

- Next.js 15, TypeScript, Tailwind CSS
- shadcn/ui, Framer Motion, Zustand
- iron-session, react-dropzone, xlsx

## Customization

Edit `/lib/checklist-data.ts` to modify the verification checklist.

## License

MIT
