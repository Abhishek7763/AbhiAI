import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey } = await req.json();
    
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Base URL and API Key are required' }, { status: 400 });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    // Attempt to fetch models from the OpenAI-compatible /models endpoint
    const response = await fetch(`${cleanBaseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      // Standard OpenAI format returns models in an array called "data"
      if (data && data.data && Array.isArray(data.data)) {
        return NextResponse.json({ success: true, models: data.data });
      }
      return NextResponse.json({ success: true, models: [] });
    } else {
      const err = await response.text();
      return NextResponse.json({ success: false, error: `Provider returned error: ${response.status} ${err}` });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect to provider URL' }, { status: 500 });
  }
}
