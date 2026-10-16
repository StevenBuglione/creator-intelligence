import { Store } from "./index.js";
const store = new Store(process.env.DATABASE_URL ?? "");
try {
  await store.migrate();
  console.log("Database migrations verified");
} finally {
  await store.close();
}
