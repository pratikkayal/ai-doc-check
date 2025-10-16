// Checklist item structure
export interface ChecklistItem {
  id: number;
  description: string;
  criteria: string;
  status?: 'pending' | 'processing' | 'verified' | 'failed';
  evidence?: Evidence;
}

// Token-based evidence anchors for PDF highlighting
export interface TokenEvidenceAnchor {
  startTokens: [string, string]; // first two tokens of the evidence
  endTokens: [string, string];   // last two tokens of the evidence
  fullText: string;              // complete evidence text for display/validation
  pageNumber?: number;           // page where this appears (optional; UI can infer)
}

// Evidence structure for verification results
export interface Evidence {
  text: string;                // human-readable summary or snippet
  pageNumber?: number;         // optional single-page pointer
  confidence?: number;
  tokens?: TokenEvidenceAnchor[]; // token-based anchors for highlighting
}

// Verification result for a single checklist item
export interface VerificationResult {
  itemId: number;
  status: 'verified' | 'failed';
  evidence: Evidence;
  reason?: string;
}

// Complete verification report
export interface VerificationReport {
  documentName: string;
  documentPath?: string; // Path to the original document file
  uploadDate: string;
  processingDate: string;
  results: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  };
}

// Document upload metadata
export interface DocumentMetadata {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  path?: string; // File path on server
  extractedText?: string; // Extracted text content from PDF/DOCX
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Session data structure
export interface SessionData {
  databricksToken?: string;
  isAuthenticated: boolean;
}

