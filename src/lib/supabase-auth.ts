import {
  createClient,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js"

export type AppAuthUser = {
  id: string
  email: string | null
}

export type AppAuthSession = {
  accessToken: string
  refreshToken: string | null
  user: AppAuthUser
}

export type AppAuthResult = {
  session: AppAuthSession | null
  user: AppAuthUser | null
  requiresEmailConfirmation: boolean
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

let browserClient: SupabaseClient | null = null

function ensureSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase auth is not configured in the frontend env.")
  }

  const url = new URL(SUPABASE_URL)

  if (url.hostname.startsWith("db.")) {
    throw new Error(
      "Use the Supabase project URL in NEXT_PUBLIC_SUPABASE_URL, for example https://<project-ref>.supabase.co, not the database host."
    )
  }
}

function normalizeSupabaseError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return new Error(
        "Nao foi possivel falar com o Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e use a URL do projeto, nao a URL do banco."
      )
    }

    return error
  }

  return new Error(fallbackMessage)
}

function getSupabaseClient() {
  ensureSupabaseConfig()

  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return browserClient
}

function normalizeUser(user: User): AppAuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
  }
}

function normalizeSession(session: Session): AppAuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    user: normalizeUser(session.user),
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AppAuthResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message || "Failed to sign up.")
    }

    return {
      session: data.session ? normalizeSession(data.session) : null,
      user: data.user ? normalizeUser(data.user) : null,
      requiresEmailConfirmation: !data.session,
    }
  } catch (error) {
    throw normalizeSupabaseError(error, "Failed to sign up.")
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      throw new Error(error?.message || "Failed to sign in.")
    }

    return normalizeSession(data.session)
  } catch (error) {
    throw normalizeSupabaseError(error, "Failed to sign in.")
  }
}

export async function fetchCurrentAuthUser(token?: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    throw new Error(error?.message || "Failed to fetch current auth user.")
  }

  return normalizeUser(data.user)
}

export async function loadAuthSession() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message || "Failed to load auth session.")
  }

  return data.session ? normalizeSession(data.session) : null
}

export function subscribeToAuthChanges(
  callback: (session: AppAuthSession | null) => void
) {
  const supabase = getSupabaseClient()

  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ? normalizeSession(session) : null)
  }).data.subscription
}

export async function clearAuthSession() {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message || "Failed to clear auth session.")
  }
}
