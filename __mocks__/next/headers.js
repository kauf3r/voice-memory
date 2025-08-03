// Mock for next/headers

export const headers = jest.fn(() => ({
  get: jest.fn().mockReturnValue('test-value'),
  has: jest.fn().mockReturnValue(true),
  forEach: jest.fn(),
  entries: jest.fn().mockReturnValue([]),
  keys: jest.fn().mockReturnValue([]),
  values: jest.fn().mockReturnValue([]),
}))

export const cookies = jest.fn(() => ({
  get: jest.fn().mockReturnValue({ value: 'test-cookie' }),
  set: jest.fn(),
  delete: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  getAll: jest.fn().mockReturnValue([]),
}))

export default {
  headers,
  cookies,
}