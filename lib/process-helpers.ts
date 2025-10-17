import { loadChecklist } from '@/lib/checklists';
import { ChecklistDefinition, ProcessingEvent, ResultEvent, CompleteEvent, ErrorEvent } from '@/types';
import { readFile } from 'fs/promises';

/**
 * Validation result for process request parameters
 */
export interface ProcessValidation {
  valid: boolean;
  error?: string;
  errorCode?: string;
  statusCode?: number;
}

/**
 * Validated process request data
 */
export interface ValidatedProcessRequest {
  filename: string;
  documentPath: string;
  checklistId: string;
  checklistData: ChecklistDefinition;
  token: string;
}

/**
 * Validate and load all required data for document processing.
 * Returns validation result with error details if validation fails.
 */
export async function validateProcessRequest(
  filename: string | null | undefined,
  documentPath: string | null | undefined,
  checklistId: string | null | undefined,
  token: string | null | undefined
): Promise<{ validation: ProcessValidation; data?: ValidatedProcessRequest }> {
  // Check required parameters
  if (!filename || !documentPath || !checklistId) {
    return {
      validation: {
        valid: false,
        error: 'Missing required parameters (filename, documentPath, checklistId)',
        errorCode: 'MISSING_PARAMETERS',
        statusCode: 400,
      },
    };
  }

  // Check authentication
  if (!token) {
    return {
      validation: {
        valid: false,
        error: 'Unauthorized - missing Databricks token',
        errorCode: 'UNAUTHORIZED',
        statusCode: 401,
      },
    };
  }

  // Verify document file exists
  try {
    await readFile(documentPath);
  } catch (error) {
    return {
      validation: {
        valid: false,
        error: 'Document file not found',
        errorCode: 'DOCUMENT_NOT_FOUND',
        statusCode: 404,
      },
    };
  }

  // Load and validate checklist
  let checklistData: ChecklistDefinition | null;
  try {
    checklistData = await loadChecklist(checklistId);
  } catch (error) {
    return {
      validation: {
        valid: false,
        error: 'Failed to load checklist - malformed JSON or file system error',
        errorCode: 'CHECKLIST_LOAD_ERROR',
        statusCode: 500,
      },
    };
  }

  if (!checklistData) {
    return {
      validation: {
        valid: false,
        error: `Checklist not found: ${checklistId}`,
        errorCode: 'CHECKLIST_NOT_FOUND',
        statusCode: 404,
      },
    };
  }

  // Validate checklist has items
  if (!checklistData.items || checklistData.items.length === 0) {
    return {
      validation: {
        valid: false,
        error: `Checklist has no items: ${checklistId}`,
        errorCode: 'CHECKLIST_EMPTY',
        statusCode: 400,
      },
    };
  }

  // All validations passed
  return {
    validation: { valid: true },
    data: {
      filename,
      documentPath,
      checklistId,
      checklistData,
      token,
    },
  };
}

/**
 * Create a typed SSE processing event
 */
export function createProcessingEvent(itemId: number): string {
  const event: ProcessingEvent = { type: 'processing', itemId };
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create a typed SSE result event
 */
export function createResultEvent(data: any): string {
  const event: ResultEvent = { type: 'result', data };
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create a typed SSE complete event
 */
export function createCompleteEvent(
  checklistId: string,
  checklistName: string,
  checklistDescription: string,
  checklistCreatedAt: string
): string {
  const event: CompleteEvent = {
    type: 'complete',
    checklistId,
    checklistName,
    checklistDescription,
    checklistCreatedAt,
  };
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create a typed SSE error event
 */
export function createErrorEvent(
  error: string,
  code?: string,
  detail?: any
): string {
  const event: ErrorEvent = {
    type: 'error',
    error,
    code,
    detail,
  };
  return `data: ${JSON.stringify(event)}\n\n`;
}

