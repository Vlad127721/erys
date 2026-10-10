interface ImportMetaEnv {
  /** Base URL of the API in production, e.g. https://api.example.com. Empty = same origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
