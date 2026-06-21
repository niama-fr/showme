import { Schema as S, Struct } from "effect";
import { readFetcher, startFetcher, updateFetcher } from "@/functions/fetcher";
import { sFetcherDoc, sFetcherFields } from "@/schemas/fetcher";
import { query } from "./_generated/server";
import { mutationHandler, queryHandler } from "./effex";
import { mutation } from "./triggers";

// QUERY -----------------------------------------------------------------------------------------------------------------------------------
export const read = query(
  queryHandler({
    args: S.Struct({}),
    returns: S.OptionFromNullOr(sFetcherDoc),
    handler: readFetcher,
  })
);

// MUTATION --------------------------------------------------------------------------------------------------------------------------------
export const stop = mutation(
  mutationHandler({
    args: S.Struct({}),
    returns: S.Null,
    handler: () => updateFetcher(() => ({ isDone: true, isPending: false })),
  })
);

export const start = mutation(
  mutationHandler({
    args: S.Struct({}),
    returns: S.Number,
    handler: () => startFetcher(),
  })
);

export const update = mutation(
  mutationHandler({
    args: sFetcherFields.mapFields(Struct.pick(["count", "page"])),
    returns: S.Null,
    handler: ({ count, page }) => updateFetcher((fetcher) => ({ count: fetcher.count + count, page })),
  })
);
