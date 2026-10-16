import { demoData } from "./demo-data.js";
import { createServer } from "../apps/api/src/server.js";
const { store, config } = await demoData();
const app = await createServer(config, store);
await app.listen({ host: "127.0.0.1", port: 4411 });
console.log("Synthetic demo API ready on 4411");
