import { ClientError, forgeRouter } from '@lifeforge/server-utils'
import z from 'zod'

import forge from '../forge'

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1'

const fetchJSON = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

const semanticScholarFetchPaper = async (doi: string) => {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '')

  const data = await fetchJSON(
    `${SEMANTIC_SCHOLAR_API}/paper/DOI:${encodeURIComponent(cleanDoi)}?fields=title,abstract,authors,year,venue,journal,externalIds`
  )

  return {
    title: data.title ?? '',
    abstract: data.abstract ?? '',
    authors: (data.authors ?? []).map((a: { name: string }) => a.name),
    year: data.year,
    journal: data.journal ?? data.venue ?? '',
    doi: data.externalIds?.DOI ?? cleanDoi,
    url: data.url ?? `https://doi.org/${cleanDoi}`
  }
}

const semanticScholarSearchPapers = async (query: string, limit = 10) => {
  const data = await fetchJSON(
    `${SEMANTIC_SCHOLAR_API}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,abstract,authors,year,venue,externalIds`
  )

  return (data.data ?? []).map((paper: {
    paperId: string
    title: string
    abstract?: string
    authors?: Array<{ name: string }>
    year?: number
    venue?: string
    externalIds?: { DOI?: string }
  }) => ({
    paperId: paper.paperId,
    title: paper.title ?? '',
    abstract: paper.abstract ?? '',
    authors: (paper.authors ?? []).map(a => a.name),
    year: paper.year,
    journal: paper.venue ?? '',
    doi: paper.externalIds?.DOI,
    url: paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : undefined
  }))
}

// 测试通过 DOI 获取单篇论文摘要
const fetchByDoi = forge
  .query()
  .description('Fetch paper abstract by DOI from Semantic Scholar')
  .input({
    query: z.object({
      doi: z.string().min(1)
    })
  })
  .callback(async ({ query }) => {
    const { doi } = query

    try {
      const paper = await semanticScholarFetchPaper(doi)
      return {
        success: true,
        paper
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new ClientError(`Failed to fetch paper: ${message}`, 500)
    }
  })

// 测试搜索论文
const searchPapers = forge
  .query()
  .description('Search papers on Semantic Scholar')
  .input({
    query: z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).default(10)
    })
  })
  .callback(async ({ query }) => {
    const { query: searchQuery, limit } = query

    try {
      const papers = await semanticScholarSearchPapers(searchQuery, limit)
      return {
        success: true,
        count: papers.length,
        papers
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new ClientError(`Failed to search papers: ${message}`, 500)
    }
  })

export default forgeRouter({
  fetchByDoi,
  searchPapers
})
