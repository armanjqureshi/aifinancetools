import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import superjson from "superjson";

type TransportOptions = {
  url: string;
  headers: () => Record<string, string>;
  fetchImpl?: typeof globalThis.fetch;
};

/** Only short, read-only requests are safe to coalesce. */
export function shouldBatchTrpcOperation(operationType: string) {
  return operationType === "query";
}

/**
 * A factsheet download can take minutes. Mutations therefore use httpLink,
 * which sends one request per operation; only queries use the batch link.
 */
export function createTrpcTransportLinks({ url, headers, fetchImpl = globalThis.fetch }: TransportOptions) {
  const withCredentials = (input: RequestInfo | URL, init?: RequestInit) =>
    fetchImpl(input, { ...(init ?? {}), credentials: "include" });

  return [
    splitLink({
      condition(op) {
        return shouldBatchTrpcOperation(op.type);
      },
      true: httpBatchLink({ url, transformer: superjson, headers, fetch: withCredentials }),
      false: httpLink({ url, transformer: superjson, headers, fetch: withCredentials }),
    }),
  ];
}
