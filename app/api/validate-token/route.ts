import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || token.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 400 }
      );
    }

    // Validate token by making a test API call to Databricks
    // For now, we'll do basic validation. In production, you'd make an actual API call
    // Example: const response = await fetch(`${databricksHost}/api/2.0/clusters/list`, {
    //   headers: { 'Authorization': `Bearer ${token}` }
    // });

    // Simulate validation (replace with actual Databricks API call)
    const isValid = token.startsWith('dapi') || token.length > 20;

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid Databricks token' },
        { status: 401 }
      );
    }

    // Store token in session
    const session = await getSession();
    session.databricksToken = token;
    session.isAuthenticated = true;
    await session.save();

    return NextResponse.json({
      success: true,
      message: 'Token validated successfully',
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate token' },
      { status: 500 }
    );
  }
}

