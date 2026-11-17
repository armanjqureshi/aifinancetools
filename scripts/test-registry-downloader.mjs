import { downloadFromRegistry } from "../server/registryDownloader.ts";

for (const slug of ["hdfc", "old-bridge"]) {
  const result = await downloadFromRegistry(slug);
  console.log(JSON.stringify({
    slug,
    success: result?.success ?? false,
    bytes: result?.buffer?.length ?? 0,
    url: result?.resolvedUrl ?? null,
    error: result?.error ?? null,
  }));
}
