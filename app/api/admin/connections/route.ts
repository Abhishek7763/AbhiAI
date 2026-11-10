import { NextResponse } from 'next/server';
import { deleteConnection, listConnections, saveConnection } from '@/lib/data/ai-config';

export async function GET() {
  try {
    return NextResponse.json({ connections: await listConnections() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load connections' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const connection = await saveConnection(data);
    return NextResponse.json({ success: true, connection });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save connection' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    
    await deleteConnection(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
