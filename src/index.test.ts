import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { JSDOM } from 'jsdom'
import { clearCache, triggerGet, useGet, usePost } from './index.js'

// Setup JSDOM
beforeAll(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  })
  global.window = dom.window as unknown as Window & typeof globalThis
  global.document = dom.window.document
  global.navigator = dom.window.navigator
  global.Event = dom.window.Event
  global.Node = dom.window.Node
  global.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  clearCache()
})

describe('useGet', () => {
  test('should fetch and return data', async () => {
    const getter = async (url: string) => ({ message: `Hello from ${url}` })
    const { result } = renderHook(() => useGet('/test', { getter }))

    await waitFor(() => {
      expect(result.current.isGetting).toBe(false)
      expect(result.current.data).toEqual({ message: 'Hello from /test' })
    })

    expect(result.current.error).toBe(null)
  })

  test('should handle fetch error', async () => {
    const getter = async () => {
      throw new Error('Fetch failed')
    }
    const { result } = renderHook(() => useGet('/error', { getter }))

    await waitFor(() => {
      expect(result.current.isGetting).toBe(false)
      expect(result.current.error?.message).toBe('Fetch failed')
    })

    expect(result.current.data).toBe(null)
  })

  test('should use query parameters', async () => {
    const getter = async (url: string) => ({ url })
    const { result } = renderHook(() =>
      useGet('/query', { getter, query: { a: '1', b: '2' } })
    )

    await waitFor(() => {
      expect(result.current.isGetting).toBe(false)
      expect(result.current.data).toEqual({ url: '/query?a=1&b=2' })
    })
  })

  test('should not refetch when data is available', async () => {
    const getter = async (url: string) => ({ message: `Data for ${url}` })
    const { result } = renderHook(() =>
      useGet('/cached', { getter, keepPreviousData: true })
    )

    await waitFor(() => expect(result.current.isGetting).toBe(false))

    const { result: result2 } = renderHook(() =>
      useGet('/cached', { getter, keepPreviousData: true })
    )

    expect(result2.current.isGetting).toBe(false)
    expect(result2.current.data).toEqual({ message: 'Data for /cached' })
  })
})

describe('triggerGet', () => {
  test('should trigger a fetch for a URL', async () => {
    let callCount = 0
    const getter = async (url: string) => {
      callCount++
      return { message: `Triggered ${url}` }
    }
    const { result } = renderHook(() => useGet('/trigger', { getter }))

    await waitFor(() => expect(callCount).toBe(1))

    act(() => {
      triggerGet('/trigger')
    })

    await waitFor(() => expect(callCount).toBe(2))
  })
})

describe('usePost', () => {
  test('should post data and update', async () => {
    const poster = async (url: string, body: any) => ({ ...body, id: 1 })
    let getCount = 0
    const getter = async (url: string) => {
      getCount++
      if (getCount > 1) { // after post
        return [{ name: 'New Item', id: 1 }]
      }
      return [] // initial
    }

    const { result: getResult } = renderHook(() => useGet('/items', { getter }))

    await waitFor(() => expect(getResult.current.isGetting).toBe(false))

    const { result } = renderHook(() =>
      usePost('/items', { poster, getUrl: '/items' })
    )

    await act(async () => {
      await result.current.post({ name: 'New Item' })
    })

    await waitFor(() => {
      expect(getResult.current.data).toEqual([{ name: 'New Item', id: 1 }])
    })

    expect(result.current.isPosting).toBe(false)
    expect(result.current.data).toEqual({ name: 'New Item', id: 1 })
    expect(result.current.error).toBe(null)
  })

  test('should handle post error', async () => {
    const poster = async () => {
      throw new Error('Post failed')
    }
    const { result } = renderHook(() => usePost('/post-error', { poster }))

    await act(async () => {
      await result.current.post({ name: 'Test' })
    })

    expect(result.current.isPosting).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Post failed')
  })

  test('should perform optimistic update and rollback on error', async () => {
    const initialData = [{ id: 1, name: 'First' }]
    const optimisticData = { id: 2, name: 'Optimistic' }

    const poster = async () => {
      throw new Error('Post failed')
    }
    const getter = async () => initialData

    const { result: getResult } = renderHook(() =>
      useGet('/optimistic', { getter, keepPreviousData: true })
    )
    await waitFor(() => expect(getResult.current.isGetting).toBe(false))

    const { result: postResult } = renderHook(() =>
      usePost('/optimistic', {
        poster,
        getUrl: '/optimistic',
        optimisticData: (current: any) => [...(current || []), optimisticData],
      })
    )

    await act(async () => {
      await postResult.current.post({ name: 'New' }).catch(() => {})
    })

    expect(getResult.current.data).toEqual(initialData)
    expect(postResult.current.isPosting).toBe(false)
  })

  test('should use response data to update get cache', async () => {
    const responseData = { id: 2, name: 'From Response' }
    const poster = async () => responseData
    const getter = async () => [{ id: 1, name: 'Initial' }]

    const { result: getResult } = renderHook(() =>
      useGet('/response-data', { getter, keepPreviousData: true })
    )
    await waitFor(() => expect(getResult.current.isGetting).toBe(false))

    const { result: postResult } = renderHook(() =>
      usePost('/response-data', {
        poster,
        getUrl: '/response-data',
        useResponseData: true,
      })
    )

    await act(async () => {
      await postResult.current.post({ name: 'New' })
    })

    expect(getResult.current.data).toEqual(responseData)
  })
})

describe('clearCache', () => {
  test('should clear all caches', async () => {
    const getter = async (url: string) => ({ message: `Data for ${url}` })
    const { result } = renderHook(() =>
      useGet('/cache-clear', { getter, keepPreviousData: true })
    )

    await waitFor(() => expect(result.current.isGetting).toBe(false))
    expect(result.current.data).not.toBeNull()

    act(() => {
      clearCache()
    })

    const { result: result2 } = renderHook(() =>
      useGet('/cache-clear', { getter, keepPreviousData: true })
    )

    expect(result2.current.data).toBe(null)
    expect(result2.current.isGetting).toBe(true)

    await waitFor(() => expect(result2.current.isGetting).toBe(false))
  })
})
