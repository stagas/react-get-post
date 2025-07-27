export const getter = (url: string) =>
  fetch(url).then(res => {
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${url}:\n  ${res.status} ${res.statusText}`,
      )
    }
    return res.json()
  })

export const poster = (url: string, body?: any) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  }).then(res => {
    if (!res.ok) {
      throw new Error(
        `Failed to post ${url}:\n  ${res.status} ${res.statusText}`,
      )
    }
    return res.json()
  })
