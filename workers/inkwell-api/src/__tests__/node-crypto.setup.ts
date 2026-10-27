import { timingSafeEqual } from 'node:crypto'

// Node Web Crypto lacks the Workers extension. Use Node's native constant-time
// implementation for the listener-free test runner; Workerd uses its own API.
Object.defineProperty(crypto.subtle, 'timingSafeEqual', {
  value: timingSafeEqual,
  configurable: true,
})
