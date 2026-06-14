/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_EVENT_MANAGER?: string;
  readonly VITE_PUBLIC_RESOLVER?: string;
  readonly VITE_EVENT_NAME?: string;
  readonly VITE_FROM_BLOCK?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
