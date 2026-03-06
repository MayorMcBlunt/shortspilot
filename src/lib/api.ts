// ─────────────────────────────────────────────────────────────────────────────
// Shared API route helpers
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export type AuthResult =
  | { user: User; errorResponse: null }
  | { user: null; errorResponse: NextResponse }

/**
 * Validates the current session and returns the user or a 401 response.
 * Use at the top of every route handler to avoid repeating auth boilerplate.
 *
 * @example
 * const { user, errorResponse } = await requireAuth()
 * if (errorResponse) return errorResponse
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { user, errorResponse: null }
}
