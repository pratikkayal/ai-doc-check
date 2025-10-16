import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { extractDocumentText } from '@/lib/pdf-utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PDF and DOCX are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(uploadsDir, filename);

    await writeFile(filepath, buffer);

    // Extract text from the document
    let extractedText = '';
    try {
      extractedText = await extractDocumentText(filepath, file.type);
      console.log(`Extracted ${extractedText.length} characters from ${filename}`);

      // Save extracted text to a separate file for easy access
      const textFilename = `${filename}.txt`;
      const textFilepath = path.join(uploadsDir, textFilename);
      await writeFile(textFilepath, extractedText, 'utf-8');
    } catch (error) {
      console.error('Error extracting text:', error);
      // Continue even if text extraction fails
    }

    return NextResponse.json({
      success: true,
      data: {
        filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        path: filepath,
        extractedText: extractedText.substring(0, 10000), // Return first 10k chars in response
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

