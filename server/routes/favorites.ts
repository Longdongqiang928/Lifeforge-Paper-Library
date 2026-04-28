import { ClientError, forgeRouter } from '@lifeforge/server-utils'
import z from 'zod'

import forge from '../forge'
import { COLLECTION_NAMES, DEFAULT_FOLDER_NAME } from '../utils/constants'
import {
  ensureAuthenticatedUser,
  ensureDefaultFavoriteFolder,
  getUserStateMap,
  mapPaperDetail
} from '../utils/records'

const listFolders = forge
  .query()
  .description('List favorite folders for the current user')
  .input({})
  .callback(async ({ pb }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    await ensureDefaultFavoriteFolder(pb.instance, userId)

    const folders = await pb.instance.collection(COLLECTION_NAMES.favoriteFolders).getFullList({
      filter: pb.instance.filter('user = {:user}', {
        user: userId
      }),
      sort: 'sort_order,name'
    })

    return folders.map((folder: Record<string, unknown>) => ({
      id: String(folder.id),
      name: String(folder.name),
      isDefault: String(folder.name) === DEFAULT_FOLDER_NAME,
      sortOrder:
        typeof folder.sort_order === 'number' ? folder.sort_order : Number(folder.sort_order) || 0
    }))
  })

const createFolder = forge
  .mutation()
  .description('Create a new favorite folder for the current user')
  .input({
    body: z.object({
      name: z.string().min(1).max(60)
    })
  })
  .callback(async ({ pb, body: { name } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const normalizedName = name.trim()

    if (!normalizedName) {
      throw new ClientError('Folder name is required', 400)
    }

    const folders = await pb.instance.collection(COLLECTION_NAMES.favoriteFolders).getFullList({
      filter: pb.instance.filter('user = {:user}', {
        user: userId
      })
    })

    if (
      folders.some(
        (folder: Record<string, unknown>) =>
          String(folder.name).toLowerCase() === normalizedName.toLowerCase()
      )
    ) {
      throw new ClientError('Folder already exists', 409)
    }

    const sortOrder = folders.reduce((max: number, folder: Record<string, unknown>) => {
      const current =
        typeof folder.sort_order === 'number' ? folder.sort_order : Number(folder.sort_order) || 0

      return Math.max(max, current)
    }, 0)

    const folder = await pb.instance
      .collection(COLLECTION_NAMES.favoriteFolders)
      .create({
        user: userId,
        name: normalizedName,
        sort_order: sortOrder + 1
      })

    return {
      id: folder.id,
      name: folder.name,
      isDefault: folder.name === DEFAULT_FOLDER_NAME,
      sortOrder: folder.sort_order
    }
  })

const renameFolder = forge
  .mutation()
  .description('Rename a favorite folder for the current user')
  .input({
    body: z.object({
      folderId: z.string(),
      name: z.string().min(1).max(60)
    })
  })
  .callback(async ({ pb, body: { folderId, name } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)
    const normalizedName = name.trim()

    if (!normalizedName) {
      throw new ClientError('Folder name is required', 400)
    }

    const folder = await pb.instance
      .collection(COLLECTION_NAMES.favoriteFolders)
      .getOne(folderId)
      .catch(() => null)

    if (!folder || String(folder.user) !== userId) {
      throw new ClientError('Favorite folder not found', 404)
    }

    if (String(folder.name) === DEFAULT_FOLDER_NAME) {
      throw new ClientError('Default folder cannot be renamed', 400)
    }

    const folders = await pb.instance.collection(COLLECTION_NAMES.favoriteFolders).getFullList({
      filter: pb.instance.filter('user = {:user}', {
        user: userId
      })
    })

    if (
      folders.some(
        (candidate: Record<string, unknown>) =>
          String(candidate.id) !== folderId &&
          String(candidate.name).toLowerCase() === normalizedName.toLowerCase()
      )
    ) {
      throw new ClientError('Folder already exists', 409)
    }

    const updated = await pb.instance.collection(COLLECTION_NAMES.favoriteFolders).update(folderId, {
      name: normalizedName
    })

    return {
      id: updated.id,
      name: updated.name,
      isDefault: updated.name === DEFAULT_FOLDER_NAME,
      sortOrder: updated.sort_order
    }
  })

const deleteFolder = forge
  .mutation()
  .description('Delete a favorite folder and move contained papers into the default folder')
  .input({
    body: z.object({
      folderId: z.string()
    })
  })
  .callback(async ({ pb, body: { folderId } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const folder = await pb.instance
      .collection(COLLECTION_NAMES.favoriteFolders)
      .getOne(folderId)
      .catch(() => null)

    if (!folder || String(folder.user) !== userId) {
      throw new ClientError('Favorite folder not found', 404)
    }

    if (String(folder.name) === DEFAULT_FOLDER_NAME) {
      throw new ClientError('Default folder cannot be deleted', 400)
    }

    const defaultFolder = await ensureDefaultFavoriteFolder(pb.instance, userId)

    const favorites = await pb.instance.collection(COLLECTION_NAMES.paperFavorites).getFullList({
      filter: pb.instance.filter('user = {:user} && folder = {:folder}', {
        user: userId,
        folder: folderId
      })
    })

    await Promise.all(
      favorites.map((favorite: Record<string, unknown>) =>
        pb.instance.collection(COLLECTION_NAMES.paperFavorites).update(String(favorite.id), {
          folder: defaultFolder.id
        })
      )
    )

    await pb.instance.collection(COLLECTION_NAMES.favoriteFolders).delete(folderId)

    return {
      success: true,
      movedCount: favorites.length
    }
  })

const list = forge
  .query()
  .description('List all favorite papers grouped by folder')
  .input({})
  .callback(async ({ pb }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const [folders, favorites, userStateMap] = await Promise.all([
      (async () => {
        await ensureDefaultFavoriteFolder(pb.instance, userId)

        return pb.instance.collection(COLLECTION_NAMES.favoriteFolders).getFullList({
          filter: pb.instance.filter('user = {:user}', {
            user: userId
          }),
          sort: 'sort_order,name'
        })
      })(),
      pb.instance.collection(COLLECTION_NAMES.paperFavorites).getFullList({
        expand: 'paper,folder',
        filter: pb.instance.filter('user = {:user}', {
          user: userId
        }),
        sort: '-updated'
      }),
      getUserStateMap(pb.instance, userId)
    ])

    const grouped = new Map<
      string,
      {
        id: string
        name: string
        papers: ReturnType<typeof mapPaperDetail>[]
      }
    >()

    for (const folder of folders) {
      grouped.set(String(folder.id), {
        id: String(folder.id),
        name: String(folder.name),
        isDefault: String(folder.name) === DEFAULT_FOLDER_NAME,
        papers: []
      })
    }

    for (const favorite of favorites) {
      const folderId = String(favorite.folder)
      const paper = favorite.expand?.paper as Record<string, unknown> | undefined

      if (!paper) continue

      const currentGroup = grouped.get(folderId)

      if (!currentGroup) continue

      currentGroup.papers.push(
        mapPaperDetail(paper, userStateMap.get(String(paper.id)), folderId)
      )
    }

    return {
      totalFavorites: favorites.length,
      folders: [...grouped.values()].map(folder => ({
        ...folder,
        count: folder.papers.length
      }))
    }
  })

const toggle = forge
  .mutation()
  .description('Toggle a paper favorite status for the current user')
  .input({
    body: z.object({
      paperId: z.string(),
      folderId: z.string().optional()
    })
  })
  .callback(async ({ pb, body: { paperId, folderId } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const paper = await pb.instance
      .collection(COLLECTION_NAMES.papers)
      .getOne(paperId)
      .catch(() => null)

    if (!paper) {
      throw new ClientError('Paper not found', 404)
    }

    const existing = await pb.instance
      .collection(COLLECTION_NAMES.paperFavorites)
      .getFirstListItem(
        pb.instance.filter('user = {:user} && paper = {:paper}', {
          user: userId,
          paper: paperId
        })
      )
      .catch(() => null)

    if (existing) {
      await pb.instance.collection(COLLECTION_NAMES.paperFavorites).delete(existing.id)

      return {
        isFavorite: false,
        favoriteFolderId: null
      }
    }

    const targetFolder = folderId
      ? await pb.instance.collection(COLLECTION_NAMES.favoriteFolders).getOne(folderId).catch(() => null)
      : await ensureDefaultFavoriteFolder(pb.instance, userId)

    if (!targetFolder || String(targetFolder.user) !== userId) {
      throw new ClientError('Favorite folder not found', 404)
    }

    await pb.instance
      .collection(COLLECTION_NAMES.paperFavorites)
      .create({
        user: userId,
        paper: paperId,
        folder: targetFolder.id
      })

    return {
      isFavorite: true,
      favoriteFolderId: targetFolder.id
    }
  })

const move = forge
  .mutation()
  .description('Move a favorite paper into another folder')
  .input({
    body: z.object({
      paperId: z.string(),
      folderId: z.string()
    })
  })
  .callback(async ({ pb, body: { paperId, folderId } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const [favorite, folder] = await Promise.all([
      pb.instance
        .collection(COLLECTION_NAMES.paperFavorites)
        .getFirstListItem(
          pb.instance.filter('user = {:user} && paper = {:paper}', {
            user: userId,
            paper: paperId
          })
        )
        .catch(() => null),
      pb.instance.collection(COLLECTION_NAMES.favoriteFolders).getOne(folderId).catch(() => null)
    ])

    if (!favorite) {
      throw new ClientError('Favorite entry not found', 404)
    }

    if (!folder || String(folder.user) !== userId) {
      throw new ClientError('Favorite folder not found', 404)
    }

    await pb.instance
      .collection(COLLECTION_NAMES.paperFavorites)
      .update(favorite.id, {
        folder: folderId
      })

    return {
      success: true,
      favoriteFolderId: folderId
    }
  })

export default forgeRouter({
  list,
  toggle,
  move,
  folders: forgeRouter({
    list: listFolders,
    create: createFolder,
    rename: renameFolder,
    delete: deleteFolder
  })
})
