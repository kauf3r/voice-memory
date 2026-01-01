// Mock for next/navigation

export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/test-path',
  query: {},
  asPath: '/test-path',
}))

export const usePathname = jest.fn(() => '/test-path')
export const useSearchParams = jest.fn(() => new URLSearchParams())
export const useParams = jest.fn(() => ({}))

export const redirect = jest.fn()
export const notFound = jest.fn()

export default {
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
  redirect,
  notFound,
}