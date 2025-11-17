/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface SparkKV {
  keys: () => Promise<string[]>
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T) => Promise<void>
  delete: (key: string) => Promise<void>
}

interface SparkUser {
  avatarUrl: string
  email: string
  id: string
  isOwner: boolean
  login: string
}

interface SparkAPI {
  llmPrompt: (strings: TemplateStringsArray, ...values: any[]) => string
  llm: (prompt: string, modelName?: string, jsonMode?: boolean) => Promise<string>
  user: () => Promise<SparkUser>
  kv: SparkKV
}

declare const spark: SparkAPI

declare global {
  interface Window {
    spark: SparkAPI
  }
}