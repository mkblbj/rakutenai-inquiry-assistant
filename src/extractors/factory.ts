import type { PlatformExtractor } from './types'
import { RakutenExtractor } from './rakuten'

const extractors: PlatformExtractor[] = [
  new RakutenExtractor(),
  // new MercariExtractor(),  // Phase 10
  // new AmazonExtractor(),   // Phase 11
]

export class ExtractorFactory {
  static create(url: string): PlatformExtractor | null {
    return extractors.find((e) => e.match(url)) ?? null
  }
}
