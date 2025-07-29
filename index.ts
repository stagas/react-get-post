import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { getter, poster } from './util'

// Convert single Maps to double Maps: Map<instanceId, Map<url, value>>
const getTriggerMap = new Map<string, Map<string, () => Promise<void>>>()
const getSetDataMap = new Map<
  string,
  Map<string, Dispatch<SetStateAction<any>>>
>()
const getDataMap = new Map<string, Map<string, unknown>>()
const setDataMap = new Map<string, Map<string, unknown>>()
const getEpochMap = new Map<string, Map<string, number>>()
const setEpochMap = new Map<string, Map<string, number>>()

let globalIdCounter = 0

function generateUniqueId(): string {
  return `instance_${++globalIdCounter}_${Date.now()}_${
    Math.random().toString(36).substr(2, 9)
  }`
}

export function clearCache() {
  getTriggerMap.clear()
  getSetDataMap.clear()
  getDataMap.clear()
  getEpochMap.clear()
  setEpochMap.clear()
}

function incrementGetEpoch(instanceId: string, url: string) {
  if (!getEpochMap.has(instanceId)) {
    getEpochMap.set(instanceId, new Map())
  }
  const instanceMap = getEpochMap.get(instanceId)!
  let epoch = instanceMap.get(url) ?? 0
  epoch = epoch + 1
  instanceMap.set(url, epoch)
  return epoch
}

function incrementSetEpoch(instanceId: string, url: string) {
  if (!setEpochMap.has(instanceId)) {
    setEpochMap.set(instanceId, new Map())
  }
  const instanceMap = setEpochMap.get(instanceId)!
  let epoch = instanceMap.get(url) ?? 0
  epoch = epoch + 1
  instanceMap.set(url, epoch)
  return epoch
}

function getFromDoubleMap<T>(
  map: Map<string, Map<string, T>>,
  instanceId: string,
  url: string,
): T | undefined {
  return map.get(instanceId)?.get(url)
}

function setInDoubleMap<T>(
  map: Map<string, Map<string, T>>,
  instanceId: string,
  url: string,
  value: T,
): void {
  if (!map.has(instanceId)) {
    map.set(instanceId, new Map())
  }
  map.get(instanceId)!.set(url, value)
}

function getAllFromUrl<T>(map: Map<string, Map<string, T>>, url: string): T[] {
  const results: T[] = []
  for (const instanceMap of map.values()) {
    const value = instanceMap.get(url)
    if (value !== undefined) {
      results.push(value)
    }
  }
  return results
}

function getAnyFromUrl<T>(
  map: Map<string, Map<string, T>>,
  url: string,
): T | undefined {
  for (const instanceMap of map.values()) {
    const value = instanceMap.get(url)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

export interface GetOptions {
  getter?: typeof getter
  query?: Record<string, string>
  keepPreviousData?: boolean
}

export function useGet<T>(url: string, options?: GetOptions) {
  const instanceId = useMemo(() => generateUniqueId(), [])

  options ??= {}
  options.getter ??= getter

  if (options.query) {
    url = `${url}?${new URLSearchParams(options.query).toString()}`
  }

  const previousData = options.keepPreviousData
    ? getAnyFromUrl(getDataMap, url) as T
    : undefined
  const [data, setData] = useState<T | null>(previousData ?? null)
  const [isGetting, setIsGetting] = useState(!data)
  const [error, setError] = useState<Error | null>(null)

  const trigger = async () => {
    const epoch = incrementGetEpoch(instanceId, url)

    if (!options.keepPreviousData) {
      setIsGetting(true)
    }

    try {
      const result = await options.getter!(url)

      if (getFromDoubleMap(getEpochMap, instanceId, url) !== epoch) return

      setData(result)
      setInDoubleMap(getDataMap, instanceId, url, result)
      setError(null)
      setIsGetting(false)
    }
    catch (error) {
      if (getFromDoubleMap(getEpochMap, instanceId, url) !== epoch) return

      setError(error as Error)
      setIsGetting(false)

      if (!data) {
        setTimeout(trigger, 1000)
      }
    }
  }

  setInDoubleMap(getTriggerMap, instanceId, url, trigger)
  setInDoubleMap(getSetDataMap, instanceId, url, setData)

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

  // Trigger all instances for this URL
  const triggers = getAllFromUrl(getTriggerMap, url)
  triggers.forEach(trigger => trigger())
}

export interface PostOptions<TRequest, TResponse> {
  poster?: typeof poster
  query?: Record<string, string>
  getUrl?: string
  getterQuery?: Record<string, string>
  optimisticData?:
    | TResponse
    | ((value: TResponse, request: TRequest) => TResponse)
  useResponseData?: boolean
}

export function usePost<TRequest, TResponse>(
  url: string,
  options?: PostOptions<TRequest, TResponse>,
) {
  const instanceId = useMemo(() => generateUniqueId(), [])

  options ??= {}
  options.poster ??= poster

  const [data, setData] = useState<TResponse | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const post = async (
    body?: TRequest,
    extraOptions?: PostOptions<TRequest, TResponse>,
  ) => {
    const epoch = incrementSetEpoch(instanceId, url)

    const opts = Object.assign({}, options, extraOptions)

    let currentUrl = url
    if (opts.query) {
      currentUrl = `${url}?${new URLSearchParams(opts.query).toString()}`
    }

    let currentGetUrl = opts.getUrl
    if (opts.getUrl && opts.getterQuery) {
      currentGetUrl = `${opts.getUrl}?${
        new URLSearchParams(opts.getterQuery).toString()
      }`
    }

    if (opts.optimisticData) {
      setData(value => {
        if (typeof opts.optimisticData === 'function') {
          // @ts-expect-error
          return opts.optimisticData(value as TResponse, body as TRequest)
        }
        return opts.optimisticData
      })
      if (opts.getUrl) {
        // Apply optimistic data to all instances of this URL
        const setDataFunctions = getAllFromUrl(getSetDataMap, currentGetUrl)
        setDataFunctions.forEach(setDataFn => setDataFn(opts.optimisticData))
      }
    }
    else {
      setIsPosting(true)
    }

    try {
      const result = await opts.poster!(currentUrl, body)

      if (getFromDoubleMap(setEpochMap, instanceId, url) !== epoch) return

      setData(result)
      setInDoubleMap(setDataMap, instanceId, url, result)
      setError(null)
      setIsPosting(false)

      if (!opts.getUrl) return

      if (opts.useResponseData) {
        // Update all instances with response data
        const setDataFunctions = getAllFromUrl(getSetDataMap, currentGetUrl)
        setDataFunctions.forEach(setDataFn => setDataFn(result))

        // Update all data maps
        for (const [instanceMapId] of getDataMap) {
          setInDoubleMap(getDataMap, instanceMapId, currentGetUrl, result)
        }
      }
      else {
        // Trigger all instances for this URL
        const triggers = getAllFromUrl(getTriggerMap, currentGetUrl)
        triggers.forEach(trigger => trigger())
      }
    }
    catch (error) {
      if (getFromDoubleMap(setEpochMap, instanceId, url) !== epoch) return

      setError(error as Error)
      setIsPosting(false)

      // rollback last saved data for all instances
      if (opts.optimisticData) {
        setData(getFromDoubleMap(setDataMap, instanceId, url) as TResponse)
        if (opts.getUrl) {
          // Restore each instance to its own previous data
          for (const [currentInstanceId, instanceMap] of getDataMap) {
            const savedData = instanceMap.get(currentGetUrl)
            const setDataFn = getFromDoubleMap(
              getSetDataMap,
              currentInstanceId,
              currentGetUrl,
            )
            if (setDataFn && savedData !== undefined) {
              setDataFn(savedData)
            }
          }
        }
      }
    }
  }

  return { data, isPosting, error, post }
}
