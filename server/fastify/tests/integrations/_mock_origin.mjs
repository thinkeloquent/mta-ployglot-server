import http from "node:http";

const ROUTES = {
  "GET /rest/api/3/myself": {
    accountId: "acc-1",
    displayName: "Mock User",
    emailAddress: "mock@x.io",
  },
  "GET /wiki/rest/api/user/current": {
    type: "known",
    accountId: "acc-conf-1",
    accountType: "atlassian",
    email: "mock@confluence.io",
    publicName: "Mock Confluence User",
    displayName: "Mock Confluence User",
  },
  "GET /user": {
    login: "mockoctocat",
    id: 42,
    name: "Mock Octocat",
    email: "octo@x.io",
  },
  "GET /v1/me": { id: "u-1", email: "mock@figma.io", handle: "mockfigma" },
  "GET /gates": {
    data: [{ id: "g-1", name: "mock_gate", isEnabled: true }],
  },
};

function saucelabsHandler(method, url) {
  const m = url.match(/^\/rest\/v1\/users\/[^/]+\/concurrency$/);
  if (method === "GET" && m) {
    return {
      concurrency: {
        organization: { allowed: { vms: 100, mac_vms: 10, rds: 1 } },
        team: { allowed: { vms: 50, mac_vms: 5, rds: 1 } },
      },
    };
  }
  return null;
}

export function startMock() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const path = req.url?.split("?")[0] ?? "";
      const key = `${req.method} ${path}`;
      const body = ROUTES[key] ?? saucelabsHandler(req.method, path);
      if (body) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      } else {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "no mock for " + key }));
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
