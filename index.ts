import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { getter, poster } from './util.js'

const getTriggerMap = new Map<string, () => Promise<void>>()
const getSetDataMap = new Map<string, Dispatch<SetStateAction<any>>>()
const getDataMap = new Map<string, unknown>()
const getEpochMap = new Map<string, number>()
const setEpochMap = new Map<string, number>()

function incrementGetEpoch(url: string) {
  let epoch = getEpochMap.get(url) ?? 0
  epoch = epoch + 1
  getEpochMap.set(url, epoch)
  return epoch
}

function incrementSetEpoch(url: string) {
  let epoch = setEpochMap.get(url) ?? 0
  epoch = epoch + 1
  setEpochMap.set(url, epoch)
  return epoch
}

export interface GetOptions {
  getter?: typeof getter
  query?: Record<string, string>
  keepPreviousData?: boolean
}

export function useGet<T>(url: string, options?: GetOptions) {
  options ??= {}
  options.getter ??= getter

  if (options.query) {
    url = `${url}?${new URLSearchParams(options.query).toString()}`
  }
  const [data, setData] = useState<T | null>(
    options.keepPreviousData ? getDataMap.get(url) as T : null,
  )
  const [isGetting, setIsGetting] = useState(!data)
  const [error, setError] = useState<Error | null>(null)

  const trigger = async () => {
    const epoch = incrementGetEpoch(url)

    if (!options.keepPreviousData) {
      setIsGetting(true)
    }

    try {
      const result = await options.getter!(url)

      if (getEpochMap.get(url) !== epoch) return

      setData(result)
      getDataMap.set(url, result)
      setError(null)
      setIsGetting(false)
    }
    catch (error) {
      if (getEpochMap.get(url) !== epoch) return

      setError(error as Error)
      setIsGetting(false)

      if (!data) {
        setTimeout(trigger, 1000)
      }
    }
  }

  getTriggerMap.set(url, trigger)
  getSetDataMap.set(url, setData)

  useEffect(() => {
    if (!data) {
      trigger()
    }
  }, [data])

  return { data, isGetting, error }
}

export function triggerGet(url: string, options?: GetOptions) {
  if (options?.query) {
    url = `${url}?${new URLSearchParams(options.query).toString()}`
  }
  getTriggerMap.get(url)?.()
}

export interface PostOptions {
  poster?: typeof poster
  query?: Record<string, string>
  getterQuery?: Record<string, string>
  optimisticData?: unknown | ((value: unknown) => unknown)
  useResponseData?: boolean
}

export function usePost<T>(url: string, getUrl: string, options?: PostOptions) {
  options ??= {}
  options.poster ??= poster

  const [data, setData] = useState<T | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const post = async (body: T, extraOptions?: PostOptions) => {
    const epoch = incrementSetEpoch(url)

    setIsPosting(true)

    const opts = Object.assign({}, options, extraOptions)

    let currentUrl = url
    if (opts.query) {
      currentUrl = `${url}?${new URLSearchParams(opts.query).toString()}`
    }

    let currentGetUrl = getUrl
    if (opts.getterQuery) {
      currentGetUrl = `${getUrl}?${
        new URLSearchParams(opts.getterQuery).toString()
      }`
    }

    if (opts.optimisticData) {
      getSetDataMap.get(currentGetUrl)?.(opts.optimisticData)
    }

    try {
      const result = await opts.poster!(currentUrl, body)

      if (setEpochMap.get(url) !== epoch) return

      setData(result)
      setError(null)
      setIsPosting(false)

      if (opts.useResponseData) {
        getSetDataMap.get(currentGetUrl)?.(result)
        getDataMap.set(currentGetUrl, result)
      }
      else {
        getTriggerMap.get(currentGetUrl)?.()
      }
    }
    catch (error) {
      if (setEpochMap.get(url) !== epoch) return

      setError(error as Error)
      setIsPosting(false)

      // rollback last saved data
      if (opts.optimisticData) {
        getSetDataMap.get(currentGetUrl)?.(getDataMap.get(currentGetUrl))
      }
    }
  }

  return { data, isPosting, error, post }
}
