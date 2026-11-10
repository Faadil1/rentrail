/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_ENABLE_LIVE_NIM_SEND?: string; readonly VITE_SMOKE_ALLOW_RECIPIENT?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
