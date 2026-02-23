import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { GoogleGenerativeAIProvider } from '@ai-sdk/google'

export interface GroundingSource {
  key: string
  title: string
  url: string
}

const GEMINI_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export function normalizeGeminiBase(input?: string): string {
  if (!input?.trim()) return GEMINI_DEFAULT_BASE
  let url = input.trim().replace(/\/+$/, '')
  if (!url.match(/\/v\d/)) url += '/v1beta'
  return url
}

export function createGoogleProvider(config: {
  apiKey: string
  baseUrl?: string
}): GoogleGenerativeAIProvider {
  return createGoogleGenerativeAI({
    apiKey: config.apiKey,
    ...(config.baseUrl
      ? {
          baseURL: normalizeGeminiBase(config.baseUrl),
          headers: { Authorization: `Bearer ${config.apiKey}` },
        }
      : {}),
  })
}
