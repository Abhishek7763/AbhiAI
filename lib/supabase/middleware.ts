import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // NOTE: Bypassed for development as requested by the user.
  // Will be re-enabled during production/last phase.
  return NextResponse.next({ request })
}
