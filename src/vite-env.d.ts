/// <reference types="vite/client" />

// https://electron-vite.org/guide/env-and-mode#global-env-variables
// *Note: `env.d.ts` was auto generated here, but if having issues with THIS specific file, move it to project src folder

interface ImportMetaEnv {
  readonly VITE_DB_URL: string
  readonly VITE_DB_KEY: string
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_UPLOADTHING_TOKEN: string
  readonly VITE_RESEND_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
