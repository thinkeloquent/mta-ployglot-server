/**
 * @param {string} [host] — bare hostname or full URL. undefined → public api.github.com.
 * @returns {{ graphql: string, rest: string, uploads: string }}
 */
export function resolveBaseUrls(host) {
  if (!host) {
    return {
      graphql: 'https://api.github.com/graphql',
      rest: 'https://api.github.com',
      uploads: 'https://uploads.github.com',
    };
  }
  const withScheme = /^https?:\/\//.test(host) ? host : `https://${host}`;
  const url = new URL(withScheme);
  const origin = url.origin;
  return {
    graphql: `${origin}/api/graphql`,
    rest: `${origin}/api/v3`,
    uploads: `${origin}/api/uploads`,
  };
}
