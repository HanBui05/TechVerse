import { en } from "@/locales/en";
import { vi } from "@/locales/vi";

export const locales = { vi, en } as const;
export type Locale = keyof typeof locales;
export const defaultLocale: Locale = "vi";
export const localeStorageKey = "techverse-language";
