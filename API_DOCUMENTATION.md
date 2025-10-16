# API Documentation

## Overview

This document describes all API endpoints available in the Document Verification System.

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints (except `/validate-token`) require a valid session with a Databricks token stored.

## Endpoints

### 1. Validate Token

Validates a Databricks Personal Access Token and stores it in an encrypted session.

**Endpoint:** `POST /api/validate-token`

**Request Body:**
```json
{
  "token": "dapi1234567890abcdef"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Token validated successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

**Status Codes:**
- `200 OK` - Token validated successfully
- `400 Bad Request` - Token missing or invalid format
- `401 Unauthorized` - Token validation failed

---

### 2. Get Checklist

Retrieves the verification checklist.

**Endpoint:** `GET /api/checklist`

**Response:**
```json
{
  "checklist": [
    {
      "id": 1,
      "description": "Company Registration Certificate",
      "criteria": "Valid company registration certificate with clear company name and registration number",
      "status": "pending"
    },
    {
      "id": 2,
      "description": "Tax Identification Number (TIN)",
      "criteria": "Valid TIN clearly visible in the document",
      "status": "pending"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Checklist retrieved successfully
- `401 Unauthorized` - No valid session

---

### 3. Upload Document

Uploads a document for verification.

**Endpoint:** `POST /api/upload`

**Request:** `multipart/form-data`
- `file`: Document file (PDF or DOCX, max 10MB)

**Response:**
```json
{
  "success": true,
  "file": {
    "name": "document.pdf",
    "size": 1234567,
    "type": "application/pdf",
    "path": "/uploads/document-1234567890.pdf"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "File size exceeds 10MB limit"
}
```

**Status Codes:**
- `200 OK` - File uploaded successfully
- `400 Bad Request` - Invalid file type or size
- `401 Unauthorized` - No valid session

**Validation Rules:**
- File types: PDF, DOCX
- Max size: 10MB
- Required: file field must be present

---

### 4. Process Document

Processes a document against the checklist. Supports both batch processing and Server-Sent Events.

#### 4a. Batch Processing

**Endpoint:** `POST /api/process`

**Request Body:**
```json
{
  "documentPath": "/uploads/document-1234567890.pdf",
  "checklist": [
    {
      "id": 1,
      "description": "Company Registration Certificate",
      "criteria": "Valid company registration certificate"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "documentName": "document.pdf",
    "uploadDate": "2025-10-16T10:30:00.000Z",
    "processingDate": "2025-10-16T10:31:00.000Z",
    "results": [
      {
        "itemId": 1,
        "status": "verified",
        "evidence": {
          "text": "Company Registration No: 12345678",
          "pageNumber": 1,
          "coordinates": { "x": 100, "y": 200, "width": 300, "height": 50 },
          "confidence": 0.95
        },
        "reason": "Valid registration certificate found"
      }
    ],
    "summary": {
      "total": 8,
      "passed": 6,
      "failed": 2,
      "successRate": 75.0
    }
  }
}
```

#### 4b. Server-Sent Events (Real-time)

**Endpoint:** `GET /api/process?documentPath=...&checklist=...`

**Query Parameters:**
- `documentPath`: URL-encoded path to uploaded document
- `checklist`: URL-encoded JSON array of checklist items

**Response:** `text/event-stream`

**Event Types:**

1. **Progress Event:**
```
event: progress
data: {"itemId":1,"status":"processing","progress":12.5}
```

2. **Result Event:**
```
event: result
data: {"itemId":1,"status":"verified","evidence":{...}}
```

3. **Complete Event:**
```
event: complete
data: {"report":{...}}
```

4. **Error Event:**
```
event: error
data: {"message":"Processing failed"}
```

**Status Codes:**
- `200 OK` - Stream started successfully
- `400 Bad Request` - Missing or invalid parameters
- `401 Unauthorized` - No valid session

---

### 5. Export Report

Exports a verification report in various formats.

**Endpoint:** `POST /api/export`

**Request Body:**
```json
{
  "report": {
    "documentName": "document.pdf",
    "uploadDate": "2025-10-16T10:30:00.000Z",
    "processingDate": "2025-10-16T10:31:00.000Z",
    "results": [...],
    "summary": {...}
  },
  "format": "json"
}
```

**Supported Formats:**
- `json` - JSON file
- `excel` - Excel spreadsheet (.xlsx)
- `pdf` - PDF document

**Response:** Binary file download

**Headers:**
- `Content-Type`: Varies by format
  - JSON: `application/json`
  - Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - PDF: `application/pdf`
- `Content-Disposition`: `attachment; filename="verification-report-{timestamp}.{ext}"`

**Status Codes:**
- `200 OK` - Export successful
- `400 Bad Request` - Invalid format or missing report
- `401 Unauthorized` - No valid session
- `500 Internal Server Error` - Export generation failed

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

## Rate Limiting

Currently, no rate limiting is implemented. For production, consider adding:
- Rate limiting middleware
- Request throttling
- API key quotas

## CORS

CORS is configured to allow requests from the same origin only. For cross-origin requests, update Next.js configuration.

## Session Management

Sessions are managed using `iron-session` with the following configuration:

- **Cookie Name:** `document_verification_session`
- **TTL:** 24 hours
- **Secure:** true (HTTPS only in production)
- **HttpOnly:** true
- **SameSite:** lax

## Example Usage

### JavaScript/Fetch

```javascript
// Validate token
const response = await fetch('/api/validate-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'dapi...' })
});
const data = await response.json();

// Upload file
const formData = new FormData();
formData.append('file', fileInput.files[0]);
const uploadResponse = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});

// Process with SSE
const eventSource = new EventSource(
  `/api/process?documentPath=${encodeURIComponent(path)}&checklist=${encodeURIComponent(JSON.stringify(checklist))}`
);

eventSource.addEventListener('result', (event) => {
  const result = JSON.parse(event.data);
  console.log('Result:', result);
});

eventSource.addEventListener('complete', (event) => {
  const report = JSON.parse(event.data);
  console.log('Complete:', report);
  eventSource.close();
});
```

### cURL

```bash
# Validate token
curl -X POST http://localhost:3000/api/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"dapi1234567890"}'

# Get checklist
curl http://localhost:3000/api/checklist \
  -H "Cookie: document_verification_session=..."

# Upload file
curl -X POST http://localhost:3000/api/upload \
  -F "file=@document.pdf" \
  -H "Cookie: document_verification_session=..."

# Export report
curl -X POST http://localhost:3000/api/export \
  -H "Content-Type: application/json" \
  -H "Cookie: document_verification_session=..." \
  -d '{"report":{...},"format":"json"}' \
  -o report.json
```

## Security Considerations

1. **Token Storage:** Tokens are encrypted in HTTP-only cookies
2. **File Validation:** Server-side validation for type and size
3. **Path Traversal:** File paths are sanitized
4. **CSRF Protection:** Built-in Next.js CSRF protection
5. **Input Sanitization:** All inputs are validated and sanitized

## Monitoring

For production, implement:
- Request logging
- Error tracking (e.g., Sentry)
- Performance monitoring
- API analytics

## Versioning

Current version: `v1` (implicit)

For future versions, consider:
- URL versioning: `/api/v2/...`
- Header versioning: `Accept: application/vnd.api+json; version=2`

