/// <reference types="vite/client" />

// https://electron-vite.org/guide/env-and-mode#global-env-variables
// *Note: `env.d.ts` was auto generated here, but if having issues with THIS specific file, move it to project src folder

interface ImportMetaEnv {
  readonly VITE_DB_URL: string
  readonly VITE_DB_KEY: string
  readonly VITE_TAKEOVER_SITE_URL: string
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_RESEND_KEY: string
  readonly VITE_UPLOADTHING_TOKEN: string
  readonly VITE_NEON_DB_URL: string
  readonly VITE_SIMPLICITY_BACKEND_URL: string
  readonly VITE_SIMPLICITY_SUPABASE_URL: string
  readonly VITE_SIMPLICITY_SUPABASE_KEY: string
  readonly VITE_EMAIL_HMAC_SECRET: string
  readonly VITE_TAKEOVER_SITE_URL: string
  /** Meant for when falling back to TakeOver's database and company doenst have theirs yet.
   * 
   * **Though might need to add extra RLS policies to make this truly have no access to any data*
   */
  readonly VITE_TAKEOVER_PSEUDO_KEY: string
  // AXON — reasoning + voice keys (both optional; AXON falls back gracefully)
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_ELEVENLABS_API_KEY?: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
