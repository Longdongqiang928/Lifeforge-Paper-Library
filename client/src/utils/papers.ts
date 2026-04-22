import dayjs from 'dayjs'

export function formatPaperDate(value?: string) {
  if (!value) return 'Unknown date'

  const parsed = dayjs(value)

  if (!parsed.isValid()) return value

  return parsed.format('YYYY-MM-DD')
}

export function formatAuthors(authors: string[]) {
  if (authors.length === 0) return 'Unknown authors'
  if (authors.length <= 3) return authors.join(', ')

  return `${authors.slice(0, 3).join(', ')}, et al.`
}

export function toggleStringInList(list: string[], value: string) {
  return list.includes(value)
    ? list.filter(item => item !== value)
    : [...list, value]
}
