import { demoData } from "./demo-data.js";
const { store } = await demoData();
await store.close();
console.log(
  "Synthetic fixtures seeded only into creator_intelligence_demo. Live data unchanged.",
);
