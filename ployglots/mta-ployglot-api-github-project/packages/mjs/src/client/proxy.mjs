import { ProxyAgent } from 'undici';
import { ConfigurationError } from './errors.mjs';

/**
 * @param {string} proxyUrl — e.g. 'http://proxy.acme:3128' or 'http://user:pass@proxy.acme:3128'
 * @returns {ProxyAgent}
 */
export function createProxyDispatcher(proxyUrl) {
  try {
    new URL(proxyUrl);
  } catch {
    throw new ConfigurationError(`invalid proxy URL: ${proxyUrl}`);
  }
  return new ProxyAgent({ uri: proxyUrl });
}
