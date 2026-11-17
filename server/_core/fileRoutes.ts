import type { Express, Request, Response } from "express";
import { FILE_ROUTE_PREFIX, keyFromFileRouteUrl, storageDirectLocation } from "../storage";
import { authenticateRequest } from "./auth";

/** Serves stored PDFs and reports at /files/<key>, only to signed-in users. */
export function registerFileRoutes(app: Express) {
  app.get(`${FILE_ROUTE_PREFIX}*`, async (req: Request, res: Response) => {
    try {
      await authenticateRequest(req);
    } catch {
      res.status(401).send("Sign in to open stored files.");
      return;
    }
    const key = keyFromFileRouteUrl(req.path);
    if (!key) {
      res.status(400).send("Invalid file path");
      return;
    }
    try {
      const location = await storageDirectLocation(key);
      res.set("Cache-Control", "private, no-store");
      if (location.kind === "redirect") {
        res.redirect(307, location.url);
        return;
      }
      res.sendFile(location.path, (error) => {
        if (error && !res.headersSent) res.status(404).send("File not found");
      });
    } catch (error) {
      console.error("[Files] failed:", error);
      if (!res.headersSent) res.status(500).send("Storage error");
    }
  });
}
