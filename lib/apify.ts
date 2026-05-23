const APIFY_BASE = 'https://api.apify.com/v2'
const REEL_ACTOR = 'apify~instagram-scraper'

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

export async function startInstagramScrapeRun(
  apiToken: string,
  usernames: string[],
  postsPerProfile = 10
): Promise<{ runId: string; datasetId: string }> {
  const directUrls = usernames.map((u) => `https://www.instagram.com/${u}/`)

  const res = await fetch(`${APIFY_BASE}/acts/${REEL_ACTOR}/runs?token=${apiToken}&memory=512`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls,
      resultsType: 'posts',
      resultsLimit: postsPerProfile,
      addParentData: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Apify ${res.status}: no se pudo iniciar el scrape`)
  }

  const data = await res.json()
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId }
}

export async function getRunStatus(apiToken: string, runId: string): Promise<{ status: string; datasetId: string }> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiToken}`)
  if (!res.ok) throw new Error(`Apify status error: ${res.status}`)
  const data = await res.json()
  return { status: data.data.status, datasetId: data.data.defaultDatasetId }
}

export async function getDatasetItems(apiToken: string, datasetId: string): Promise<ApifyReelResult[]> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${apiToken}&clean=true`)
  if (!res.ok) throw new Error(`Apify dataset error: ${res.status}`)
  return res.json()
}
