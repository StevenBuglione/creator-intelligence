import { getConfig } from "../../../packages/config/src/index.js";
import { createServer } from "./server.js";
const config = getConfig();
const app = await createServer(config);
await app.listen({ host: config.HOST, port: config.PORT });
console.log(`Creator Intelligence API ready on port ${config.PORT}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
