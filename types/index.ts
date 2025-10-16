// Checklist item structure
export interface ChecklistItem {
  id: number;
  description: string;
  criteria: string;
  status?: 'pending' | 'processing' | 'verified' | 'failed';
  evidence?: Evidence;
}

// Evidence structure for verification results
export interface Evidence {
  text: string;
  pageNumber: number;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
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

