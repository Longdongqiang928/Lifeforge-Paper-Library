import { ClientError, forgeRouter } from '@lifeforge/server-utils'
import z from 'zod'

import forge from '../forge'

const OPENALEX_API = 'https://api.openalex.org'

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

// 解码 OpenAlex 倒排索引格式的摘要
function decodeAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return ''

  // 按位置排序重建句子
  const wordPositions: Array<{ word: string; position: number }> = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ word, position: pos })
    }
  }

  // 按位置排序后拼接
  wordPositions.sort((a, b) => a.position - b.position)
  return wordPositions.map(w => w.word).join(' ')
}

const openalexFetchByDoi = async (doi: string) => {
  // 清理 DOI 格式
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '')

  // OpenAlex 使用 filter 查询
  const data = await fetchJSON(
    `${OPENALEX_API}/works?filter=doi:${encodeURIComponent(cleanDoi)}&per_page=1`
  )

  const results = data.results ?? []
  if (results.length === 0) {
    throw new Error('Paper not found')
  }

  const work = results[0]

  return {
    title: work.title ?? '',
    abstract: decodeAbstract(work.abstract_inverted_index),
    authors: (work.authorships ?? []).map((a: { author: { display_name: string } }) => a.author?.display_name ?? '').filter(Boolean),
    year: work.publication_year,
    journal: work.primary_location?.source?.display_name ?? '',
    doi: work.doi ?? cleanDoi,
    url: work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : undefined
  }
}

const openalexSearchPapers = async (query: string, limit = 10) => {
  const data = await fetchJSON(
    `${OPENALEX_API}/works?search=${encodeURIComponent(query)}&per_page=${limit}&filter=has_abstract:true&sort=cited_by_count:desc`
  )

  return (data.results ?? []).map((work: {
    id: string
    title: string
    abstract_inverted_index?: Record<string, number[]>
    authorships?: Array<{ author: { display_name: string } }>
    publication_year?: number
    primary_location?: { source?: { display_name: string } }
    doi?: string
  }) => ({
    id: work.id,
    title: work.title ?? '',
    abstract: decodeAbstract(work.abstract_inverted_index),
    authors: (work.authorships ?? []).map((a) => a.author?.display_name ?? '').filter(Boolean),
    year: work.publication_year,
    journal: work.primary_location?.source?.display_name ?? '',
    doi: work.doi,
    url: work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : undefined
  }))
}

// 测试通过 DOI 获取单篇论文摘要
const fetchByDoi = forge
  .query()
  .description('Fetch paper abstract by DOI from OpenAlex')
  .input({
    query: z.object({
      doi: z.string().min(1)
    })
  })
  .callback(async ({ query }) => {
    const { doi } = query

    try {
      const paper = await openalexFetchByDoi(doi)
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
  .description('Search papers on OpenAlex')
  .input({
    query: z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).default(10)
    })
  })
  .callback(async ({ query }) => {
    const { query: searchQuery, limit } = query

    try {
      const papers = await openalexSearchPapers(searchQuery, limit)
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
