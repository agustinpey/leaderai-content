const APIFY_BASE = 'https://api.apify.com/v2'
const REEL_ACTOR = 'apify~instagram-reel-scraper'

export interface ApifyReelResult {
  id: string
  shortCode: string
  url: string
  caption: string
  likesCount: number
  commentsCount: number
  videoViewCount?: number
  videoPlayCount?: number
  timestamp: string
  displayUrl?: string
  ownerUsername: string
  ownerFullName?: string
}

export async function scrapeInstagramReels(
  apiToken: string,
  usernames: string[],
  postsPerProfile = 20
): Promise<ApifyReelResult[]> {
  const directUrls = usernames.map((u) => ({
    url: `https://www.instagram.com/${u}/reels/`,
  }))

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${REEL_ACTOR}/run-sync-get-dataset-items?token=${apiToken}&timeout=55&memory=256`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directUrls, resultsLimit: postsPerProfile }),
      signal: AbortSignal.timeout(58_000),
    }
  )

  if (!runRes.ok) {
    const err = await runRes.json().catch(() => ({}))
    throw new Error(err.error?.message || `Apify error: ${runRes.status}`)
  }

  const items: ApifyReelResult[] = await runRes.json()
  return items
}
