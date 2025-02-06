/// <reference types="vite/client" />

// https://electron-vite.org/guide/env-and-mode#global-env-variables
// *Note: `env.d.ts` was auto generated here, but if having issues with THIS specific file, move it to project src folder

interface ImportMetaEnv {
  readonly VITE_DATABASE_URL: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
