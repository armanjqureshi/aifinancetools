import { listAmcSourcesWithLatestDocuments } from "../server/db.ts";
const sources = await listAmcSourcesWithLatestDocuments();
for (const source of sources) {
  if (source.isActive === 1 && !source.latestDocument?.fileUrl) console.log(source.amcSlug);
}
