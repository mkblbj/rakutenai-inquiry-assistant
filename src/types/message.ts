export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  status?: 'pending' | 'streaming' | 'done' | 'error'
}
