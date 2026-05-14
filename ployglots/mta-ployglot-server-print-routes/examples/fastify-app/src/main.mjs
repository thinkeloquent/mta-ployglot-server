import Fastify from "fastify";
import { setupRouteCollector, printRoutes } from "@mta/print-routes-fastify";

const app = Fastify({ logger: true });

// Attach the collector BEFORE any route is registered.
setupRouteCollector(app);

app.get("/hello", async () => ({ message: "hello" }));
app.post("/echo", async (req) => ({ got: req.body }));

app.addHook("onReady", async () => {
  printRoutes(app);
});

const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "51000", 10);

try {
  await app.listen({ host, port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
