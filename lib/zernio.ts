const ZERNIO_BASE = 'https://api.zernio.com/v1'

export interface ZernioPostAnalytics {
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  views: number
  engagementRate: number
}

export interface ZernioPost {
  _id: string
  content: string
  publishedAt: string
  status: string
  analytics: ZernioPostAnalytics
  platforms: Array<{
    platform: string
    status: string
    platformPostId: string
    accountId: string
    accountUsername: string
    analytics: ZernioPostAnalytics
    platformPostUrl: string
  }>
}

export interface ZernioAnalyticsResponse {
  overview: {
    totalPosts: number
    publishedPosts: number
    lastSync: string
  }
  posts: ZernioPost[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ZernioAccount {
  _id: string
  platform: string
  username: string
  displayName: string
  followersCount: number
  profilePictureUrl: string
}

async function zernioFetch(apiKey: string, path: string) {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Zernio ${res.status}: ${path}`)
  }
  return res.json()
}

export async function getZernioAccounts(apiKey: string): Promise<ZernioAccount[]> {
  const data = await zernioFetch(apiKey, '/accounts')
  return data.data || data || []
}

export async function getZernioPosts(
  apiKey: string,
  options: { fromDate?: string; toDate?: string; limit?: number; page?: number } = {}
): Promise<ZernioAnalyticsResponse> {
  const params = new URLSearchParams({
    platform: 'instagram',
    limit: String(options.limit || 50),
    page: String(options.page || 1),
    sortBy: 'date',
    order: 'desc',
  })
  if (options.fromDate) params.set('fromDate', options.fromDate)
  if (options.toDate) params.set('toDate', options.toDate)

  return zernioFetch(apiKey, `/analytics?${params}`)
}

export async function getZernioAccountInsights(apiKey: string, accountId: string) {
  return zernioFetch(
    apiKey,
    `/analytics/instagram/account-insights?accountId=${accountId}`
  )
}
