/**
 * @typedef {string | (() => string | Promise<string>)} TokenInput
 */

/**
 * @param {TokenInput} token
 * @returns {() => Promise<string>} async function returning the Bearer header value.
 */
export function makeAuth(token) {
  if (typeof token === 'string') {
    const header = `Bearer ${token}`;
    return async () => header;
  }
  if (typeof token === 'function') {
    return async () => `Bearer ${await token()}`;
  }
  throw new Error('token must be a string or a function');
}
