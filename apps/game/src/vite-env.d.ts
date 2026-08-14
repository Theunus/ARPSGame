/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Secret code that unlocks staff/demo mode. See src/demo.ts. */
  readonly VITE_STAFF_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
