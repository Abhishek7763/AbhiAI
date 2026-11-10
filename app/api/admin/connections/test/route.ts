import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey, modelId } = await req.json();
    
    if (!baseUrl || !apiKey || !modelId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Standard OpenAI compatible chat completions endpoint test
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return NextResponse.json({ success: true, response: data.choices[0].message.content });
      }
      return NextResponse.json({ success: false, error: 'Invalid response format from provider' });
    } else {
      const errorText = await response.text();
      return NextResponse.json({ success: false, error: `Provider error: ${response.status} ${errorText}` });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect' }, { status: 500 });
  }
}
