import { NextResponse } from 'next/server';
import { getProviders, saveProviders, ProviderConfig } from '@/lib/providers';

export async function GET() {
  const providers = getProviders();
  // Don't send full API keys back to the client for security, just mask them or send existence
  const maskedProviders: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(providers)) {
    maskedProviders[key] = {
      id: value.id,
      hasKey: !!value.apiKey,
      isActive: value.isActive
    };
  }
  
  return NextResponse.json({ providers: maskedProviders });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const currentProviders = getProviders();
    
    const newProviders: Record<string, ProviderConfig> = { ...currentProviders };
    
    // Update with new data
    for (const [providerId, config] of Object.entries(data)) {
      const c = config as any;
      
      if (!newProviders[providerId]) {
        newProviders[providerId] = { id: providerId, apiKey: '', isActive: false };
      }
      
      // Only update API key if one was provided (don't overwrite with empty if they just want to set active)
      if (c.apiKey) {
        newProviders[providerId].apiKey = c.apiKey;
      }
      
      if (c.isActive !== undefined) {
        newProviders[providerId].isActive = c.isActive;
      }
    }
    
    // If one is set to active, unset others
    const activeProvider = Object.entries(data).find(([_, config]: [string, any]) => config.isActive);
    if (activeProvider) {
      for (const key of Object.keys(newProviders)) {
        if (key !== activeProvider[0]) {
          newProviders[key].isActive = false;
        }
      }
    }
    
    const success = saveProviders(newProviders);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
