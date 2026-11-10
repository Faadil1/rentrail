/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_ENABLE_LIVE_NIM_SEND?: string; readonly VITE_SMOKE_ALLOW_RECIPIENT?: string; readonly VITE_SMOKE_ALLOW_CHARGE_ID?: string; readonly VITE_SMOKE_ALLOW_AMOUNT_LUNA?: string; readonly VITE_SMOKE_ALLOW_PERIOD?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
