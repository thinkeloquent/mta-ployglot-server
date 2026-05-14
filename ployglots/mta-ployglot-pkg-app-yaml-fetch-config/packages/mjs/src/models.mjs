export function createEndpointConfig(data, key = '') {
  return {
    key,
    name: data.name || key,
    tags: [...(data.tags || [])],
    baseUrl: data.baseUrl || data.baseurl || '',
    description: data.description || '',
    method: data.method || 'POST',
    headers: { ...(data.headers || {}) },
    timeout: data.timeout !== undefined ? data.timeout : 30000,
    bodyType: data.bodyType || 'json',
  };
}

export function createFetchConfig({ serviceId, url, method, headers, body, timeout }) {
  return { serviceId, url, method, headers, body, headersTimeout: timeout };
}
