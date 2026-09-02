import { NextResponse } from 'next/server';
import { getConnections } from '@/lib/connections';

export async function GET() {
  const connections = getConnections();
  
  // Filter active and public connections, and only return safe data
  const publicModels = Object.values(connections)
    .filter(c => c.isActive && c.scope === 'public')
    .map(c => ({
      id: c.id,
      name: c.assignedAlias || c.name,
      originalName: c.name
    }));
    
  return NextResponse.json({ models: publicModels });
}
