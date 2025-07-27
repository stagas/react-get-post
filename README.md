# react-get-post

A lightweight and powerful React hook library for data fetching with GET and POST operations. Features built-in caching, loading states, error handling, optimistic updates, and race condition prevention.

[![npm version](https://badge.fury.io/js/react-get-post.svg)](https://badge.fury.io/js/react-get-post)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **Simple & Intuitive** - Easy-to-use hooks for common data fetching patterns
- 🎯 **TypeScript Support** - Full TypeScript support with proper type inference
- 💾 **Built-in Caching** - Automatic response caching across component instances
- ⚡ **Optimistic Updates** - Instant UI updates with automatic rollback on errors
- 🔄 **Auto Retry** - Intelligent retry logic for failed requests
- 🛡️ **Race Condition Safe** - Built-in epoch system prevents stale data updates
- 🎛️ **Flexible Configuration** - Customizable getter/poster functions and options
- 📦 **Lightweight** - Minimal dependencies, only requires React

## Installation

```bash
npm install react-get-post
```

## Quick Start

### Basic GET Request

```tsx
import { useGet } from 'react-get-post'

function UserProfile({ userId }: { userId: string }) {
  const { data, isGetting, error } = useGet<User>(`/api/users/${userId}`)

  if (isGetting) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>Hello {data?.name}!</div>
}
```

### Basic POST Request

```tsx
import { usePost } from 'react-get-post'

function CreateUser() {
  const { isPosting, error, post } = usePost<User>('/api/users', '/api/users')

  const handleSubmit = async (userData: Partial<User>) => {
    await post(userData)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={isPosting}>
        {isPosting ? 'Creating...' : 'Create User'}
      </button>
      {error && <div>Error: {error.message}</div>}
    </form>
  )
}
```

## API Reference

### `useGet<T>(url: string, options?: GetOptions)`

Hook for GET requests with automatic caching and loading states.

#### Parameters

- `url` - The endpoint URL to fetch from
- `options` - Optional configuration object

#### Options

```typescript
interface GetOptions {
  getter?: (url: string) => Promise<T>  // Custom fetch function
  query?: Record<string, string>        // Query parameters
  keepPreviousData?: boolean           // Maintain previous data while refetching
}
```

#### Returns

```typescript
{
  data: T | null        // The fetched data
  isGetting: boolean    // Loading state
  error: Error | null   // Error state
}
```

#### Example

```tsx
const { data, isGetting, error } = useGet<User[]>('/api/users', {
  query: { page: '1', limit: '10' },
  keepPreviousData: true
})
```

### `usePost<T>(url: string, getUrl: string, options?: PostOptions)`

Hook for POST requests with optimistic updates and automatic data synchronization.

#### Parameters

- `url` - The endpoint URL to post to
- `getUrl` - The GET endpoint to refresh/sync after successful POST
- `options` - Optional configuration object

#### Options

```typescript
interface PostOptions {
  poster?: (url: string, body: T) => Promise<any>  // Custom post function
  query?: Record<string, string>                   // Query parameters for POST
  getterQuery?: Record<string, string>             // Query parameters for GET refresh
  optimisticData?: unknown | ((value: unknown) => unknown)  // Optimistic update data
  useResponseData?: boolean                        // Use POST response for data update
}
```

#### Returns

```typescript
{
  data: T | null                                    // Response data from POST
  isPosting: boolean                               // Loading state
  error: Error | null                              // Error state
  post: (body: T, extraOptions?: PostOptions) => Promise<void>  // Post function
}
```

#### Example with Optimistic Updates

```tsx
const { post, isPosting } = usePost<User>('/api/users', '/api/users', {
  optimisticData: (users: User[]) => [...users, newUser],
  useResponseData: true
})

const handleCreate = async (userData: Partial<User>) => {
  await post(userData)
}
```

### `triggerGet(url: string, options?: GetOptions)`

Manually trigger a GET request for a specific URL. Useful for refreshing data from outside components.

#### Example

```tsx
import { triggerGet } from 'react-get-post'

// Refresh user data from anywhere in your app
triggerGet('/api/users', { query: { page: '1' } })
```

## Advanced Usage

### Custom Fetch Functions

```tsx
import { useGet, usePost } from 'react-get-post'

const customGetter = async (url: string) => {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return response.json()
}

const { data } = useGet('/api/protected', { getter: customGetter })
```

### Optimistic Updates with Rollback

```tsx
const { post } = usePost<Todo>('/api/todos', '/api/todos', {
  optimisticData: (todos: Todo[]) => [
    ...todos,
    { id: Date.now(), text: 'New todo', completed: false }
  ]
})

// If the POST fails, the optimistic update is automatically rolled back
await post({ text: 'New todo', completed: false })
```

### Data Persistence Across Components

```tsx
// Component A
const { data } = useGet<User>('/api/user', { keepPreviousData: true })

// Component B (mounted later) - instantly gets cached data
const { data } = useGet<User>('/api/user', { keepPreviousData: true })
```

## Error Handling

The library includes built-in error handling and retry logic:

- **Automatic Retry**: Failed requests are automatically retried after 1 second if no data exists
- **Race Condition Prevention**: Epoch system ensures only the latest request updates the state
- **Optimistic Rollback**: Failed optimistic updates are automatically rolled back

## TypeScript Support

Full TypeScript support with generic type parameters:

```tsx
interface User {
  id: number
  name: string
  email: string
}

const { data } = useGet<User>('/api/user/1')  // data is typed as User | null
const { post } = usePost<Partial<User>>('/api/users', '/api/users')
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Author

**stagas**
- GitHub: [@stagas](https://github.com/stagas)
- Email: gstagas@gmail.com
