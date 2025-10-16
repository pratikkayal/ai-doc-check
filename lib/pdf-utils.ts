import { readFile } from 'fs/promises';

/**
 * Extract text content from a PDF file using pdf-parse
 * Tries to load the CommonJS build explicitly to avoid DOM dependency issues.
 * @param filePath - Path to the PDF file
 * @returns Extracted text content
 */
export async function extractPDFText(filePath: string): Promise<string> {
  try {
    const dataBuffer = await readFile(filePath);

    // Try to load the CJS build directly to avoid ESM/DOM issues in Node
    let pdfParse: any;
    try {
      const mod = await import('pdf-parse/lib/pdf-parse.js');
      pdfParse = (mod as any).default || (mod as any);
    } catch (e) {
      const mod = await import('pdf-parse');
      pdfParse = (mod as any).default || (mod as any);
    }

    if (typeof pdfParse !== 'function') {
      throw new Error('pdf-parse module did not export a function');
    }

    const data = await pdfParse(dataBuffer);
    return data?.text || '';
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text content from a DOCX file
 * Note: This is a placeholder. For production, use a library like mammoth
 * @param filePath - Path to the DOCX file
 * @returns Extracted text content
 */
export async function extractDOCXText(filePath: string): Promise<string> {
  try {
    // For now, just read as text (not ideal for DOCX)
    // In production, use mammoth.js or similar
    const buffer = await readFile(filePath);
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

/**
 * Extract text from a document based on file type
 * @param filePath - Path to the document file
 * @param fileType - MIME type of the file
 * @returns Extracted text content
 */
export async function extractDocumentText(
  filePath: string,
  fileType: string
): Promise<string> {
  if (fileType === 'application/pdf') {
    return extractPDFText(filePath);
  } else if (
    fileType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return extractDOCXText(filePath);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
}

