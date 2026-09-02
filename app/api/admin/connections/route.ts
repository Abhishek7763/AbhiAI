import { NextResponse } from 'next/server';
import { getConnections, saveConnections, AIConnection } from '@/lib/connections';
import { FILE_STORE_UNAVAILABLE_MESSAGE } from '@/lib/config/file-store';

export async function GET() {
  const connections = getConnections();
  return NextResponse.json({ connections: Object.values(connections) });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const connections = getConnections();
    
    // Create new or update
    const id = data.id || crypto.randomUUID();
    
    connections[id] = {
      ...data,
      id
    };
    
    if (!saveConnections(connections)) {
      return NextResponse.json(
        { error: FILE_STORE_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, connection: connections[id] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    
    const connections = getConnections();
    delete connections[id];
    if (!saveConnections(connections)) {
      return NextResponse.json(
        { error: FILE_STORE_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
