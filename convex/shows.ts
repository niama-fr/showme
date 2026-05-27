import { TableAggregate } from "@convex-dev/aggregate";
import { Migrations } from "@convex-dev/migrations";
import { getYear } from "date-fns";
import { Array as Arr, Effect as E, HashMap as H, Option as O, Schema as S, Struct } from "effect";
import type { HttpClientError } from "effect/unstable/http/HttpClientError";
import { getDistinctChannelsFromShows, getOrCreateChannels } from "@/functions/channels";
import { getDistinctCountriesFromShows, getOrCreateCountries } from "@/functions/countries";
import { readEpisodesByShow } from "@/functions/episodes";
import { startFetcher } from "@/functions/fetcher";
import { getOrCreateShows, readMaxApiIdShow, readPaginatedShows, readShowByApiId, showFromDoc, upsertShow } from "@/functions/shows";
import { sShowCreate, sShowWithEpisodesCreate } from "@/schemas/creates";
import { sShow, sShowRef, sShowRevision } from "@/schemas/shows";
import { TvMaze } from "@/services/tvmaze";
import { api, components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action, query } from "./_generated/server";
import { actionHandler, mutationHandler, queryHandler } from "./effex";
import type { DocNotFoundInTable } from "./effex/errors";
import { FIELDS } from "./effex/fields";
import { sId } from "./effex/schemas/genericId";
import { ActionCtx, type ActionCtxDeps } from "./effex/services/ActionCtx";
import { DatabaseReader } from "./effex/services/DatabaseReader";
import { MutationCtx, type MutationCtxDeps } from "./effex/services/MutationCtx";
import { Scheduler } from "./effex/services/Scheduler";
import { optionMapEffect, sPaginated, sPaginationWith } from "./effex/utils";
import { mutation, triggers } from "./triggers";

// AGGREGATES ------------------------------------------------------------------------------------------------------------------------------
export const favoriteShows = new TableAggregate<AggregateShowsParams<boolean, string>>(components.favoriteShows, {
  namespace: ({ preference }) => {
    if (preference === "favorite") return true;
  },
  sortKey: ({ name }) => name,
});
triggers.register("shows", favoriteShows.trigger());

export const topRatedShows = new TableAggregate<AggregateShowsParams<boolean, number>>(components.topRatedShows, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && !!premiered) return true;
  },
  sortKey: ({ rating }) => -rating,
});
triggers.register("shows", topRatedShows.trigger());

export const topRatedShowsByYear = new TableAggregate<AggregateShowsParams<number, number>>(components.topRatedShowsByYear, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && !!premiered) return getYear(premiered);
  },
  sortKey: ({ rating }) => -rating,
});
triggers.register("shows", topRatedShowsByYear.trigger());

export const topRatedShowsByPreference = new TableAggregate<AggregateShowsParams<string, [number, string]>>(
  components.topRatedShowsByPreference,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && !!premiered && preference) return preference;
    },
    sortKey: ({ rating, name }) => [-rating, name],
  }
);
triggers.register("shows", topRatedShowsByPreference.trigger());

export const topRatedShowsByPreferenceAndYear = new TableAggregate<AggregateShowsParams<string, [number, string]>>(
  components.topRatedShowsByPreferenceAndYear,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && !!premiered && preference) return `${preference}-${getYear(premiered)}`;
    },
    sortKey: ({ rating, name }) => [-rating, name],
  }
);
triggers.register("shows", topRatedShowsByPreferenceAndYear.trigger());

export const trendingShows = new TableAggregate<AggregateShowsParams<boolean, [number, number]>>(components.trendingShows, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && !!premiered) return true;
  },
  sortKey: ({ rating, weight }) => [-weight, -rating],
});
triggers.register("shows", trendingShows.trigger());

export const trendingShowsByYear = new TableAggregate<AggregateShowsParams<number, [number, number]>>(components.trendingShowsByYear, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && !!premiered) return getYear(premiered);
  },
  sortKey: ({ rating, weight }) => [-weight, -rating],
});
triggers.register("shows", trendingShowsByYear.trigger());

export const trendingShowsByPreference = new TableAggregate<AggregateShowsParams<string, [number, number, string]>>(
  components.trendingShowsByPreference,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && !!premiered && preference) return preference;
    },
    sortKey: ({ rating, weight, name }) => [-weight, -rating, name],
  }
);
triggers.register("shows", trendingShowsByPreference.trigger());

export const trendingShowsByPreferenceAndYear = new TableAggregate<AggregateShowsParams<string, [number, number, string]>>(
  components.trendingShowsByPreferenceAndYear,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && !!premiered && preference) return `${preference}-${getYear(premiered)}`;
    },
    sortKey: ({ rating, weight, name }) => [-weight, -rating, name],
  }
);
triggers.register("shows", trendingShowsByPreferenceAndYear.trigger());

// QUERIES ---------------------------------------------------------------------------------------------------------------------------------
export const readMissingOrStale = query(
  queryHandler({
    args: S.Struct({ revisions: S.Array(sShowRevision) }),
    returns: S.Array(S.Struct({ apiId: S.Int, includeEpisodes: S.Boolean })),
    handler: E.fn(function* ({ revisions }) {
      const items: { apiId: number; includeEpisodes: boolean }[] = [];
      for (const { apiId, updated } of revisions) {
        const show = yield* readShowByApiId(apiId);
        if (O.isNone(show) || show.value.updated < updated)
          items.push({ apiId, includeEpisodes: O.isSome(show) && show.value.trackEpisodes });
      }
      return items;
    }),
  })
);

export const readById = query(
  queryHandler({
    args: sShowRef,
    returns: S.OptionFromNullOr(sShow),
    handler: E.fn(function* ({ _id }) {
      const db = yield* DatabaseReader;
      return yield* optionMapEffect(yield* db.get("shows", _id), showFromDoc);
    }),
  })
);

export const readPaginatedFavorites = query(
  queryHandler({
    args: sPaginationWith({}),
    returns: sPaginated(sShow),
    handler: (pageArgs) => readPaginatedShows({ aggregate: favoriteShows, opts: { namespace: true } })(pageArgs),
  })
);

export const readPaginatedTopRated = query(
  queryHandler({
    args: sPaginationWith({ preference: S.optional(FIELDS.shows.preference), year: S.optional(S.Int) }),
    returns: sPaginated(sShow),
    handler: ({ preference, year, ...pageArgs }) => {
      if (preference && year)
        return readPaginatedShows({ aggregate: topRatedShowsByPreferenceAndYear, opts: { namespace: `${preference}-${year}` } })(pageArgs);
      if (preference) return readPaginatedShows({ aggregate: topRatedShowsByPreference, opts: { namespace: preference } })(pageArgs);
      if (year) return readPaginatedShows({ aggregate: topRatedShowsByYear, opts: { namespace: year } })(pageArgs);
      return readPaginatedShows({ aggregate: topRatedShows, opts: { namespace: true } })(pageArgs);
    },
  })
);

export const readPaginatedTopRatedUnset = query(
  queryHandler({
    args: sPaginationWith({ year: S.optional(S.Int) }),
    returns: sPaginated(sShow),
    handler: ({ year, ...pageArgs }) =>
      year === undefined
        ? readPaginatedShows({ aggregate: topRatedShowsByPreference, opts: { namespace: "unset" } })(pageArgs)
        : readPaginatedShows({ aggregate: topRatedShowsByPreferenceAndYear, opts: { namespace: `unset-${year}` } })(pageArgs),
  })
);

export const readPaginatedTrending = query(
  queryHandler({
    args: sPaginationWith({ preference: S.optional(FIELDS.shows.preference), year: S.optional(S.Int) }),
    returns: sPaginated(sShow),
    handler: ({ preference, year, ...pageArgs }) => {
      if (preference && year)
        return readPaginatedShows({ aggregate: trendingShowsByPreferenceAndYear, opts: { namespace: `${preference}-${year}` } })(pageArgs);
      if (preference) return readPaginatedShows({ aggregate: trendingShowsByPreference, opts: { namespace: preference } })(pageArgs);
      if (year) return readPaginatedShows({ aggregate: trendingShowsByYear, opts: { namespace: year } })(pageArgs);
      return readPaginatedShows({ aggregate: trendingShows, opts: { namespace: true } })(pageArgs);
    },
  })
);

export const readPaginatedTrendingUnset = query(
  queryHandler({
    args: sPaginationWith({ year: S.optional(S.Int) }),
    returns: sPaginated(sShow),
    handler: ({ year, ...pageArgs }) =>
      year === undefined
        ? readPaginatedShows({ aggregate: trendingShowsByPreference, opts: { namespace: "unset" } })(pageArgs)
        : readPaginatedShows({ aggregate: trendingShowsByPreferenceAndYear, opts: { namespace: `unset-${year}` } })(pageArgs),
  })
);

export const searchByName = query(
  queryHandler({
    args: S.Struct({ search: S.String }),
    returns: S.Array(sShow),
    handler: E.fn(function* ({ search }) {
      const db = yield* DatabaseReader;
      const docs = yield* db
        .query("shows")
        .withSearchIndex("search_name", (q) => q.search("name", search))
        .take(10);
      return yield* E.all(docs.map(showFromDoc));
    }),
  })
);

// MUTATIONS -------------------------------------------------------------------------------------------------------------------------------
export const createManyMissing = mutation(
  mutationHandler({
    args: S.Struct({ dtos: S.mutable(S.Array(sShowCreate)) }),
    returns: S.Number,
    handler: E.fn(function* ({ dtos }) {
      const maxApiIdShow = yield* readMaxApiIdShow();
      const newShows = dtos.filter((dto) => O.isNone(maxApiIdShow) || dto.apiId > maxApiIdShow.value.apiId);
      if (newShows.length === 0) return 0;
      const countryIds = yield* getOrCreateCountries(getDistinctCountriesFromShows(newShows));
      const channelIds = yield* getOrCreateChannels(getDistinctChannelsFromShows(newShows), { countryIds });
      return yield* getOrCreateShows(newShows, { channelIds, checkExisting: false }).pipe(E.map(H.size));
    }),
  })
);

export const fetchManyMissing = mutation(
  mutationHandler({
    args: S.Struct({}),
    returns: S.Null,
    handler: E.fn(function* (): E.fn.Return<null, S.SchemaError | DocNotFoundInTable<"fetcher">, MutationCtxDeps> {
      const scheduler = yield* Scheduler;
      const page = yield* startFetcher();
      yield* scheduler.runAfter(0, api.shows.fetchManyMissingByPage, { page });
      return null;
    }),
  })
);

export const setPreference = mutation(
  mutationHandler({
    args: sShow.mapFields(Struct.pick(["_id", "preference"])),
    returns: S.Null,
    handler: E.fn(function* ({ _id, preference }): E.fn.Return<null, S.SchemaError, MutationCtxDeps> {
      const { db, scheduler } = yield* MutationCtx;

      yield* db.patch("shows", _id, { preference });

      const episodes = yield* readEpisodesByShow(_id);
      for (const episode of episodes) yield* db.patch("episodes", episode._id, { preference });

      if (preference === "favorite") {
        const { apiId } = (yield* db.get("shows", _id)).pipe(O.getOrThrow);
        yield* scheduler.runAfter(0, api.episodes.fetchForShow, { _id, apiId });
      }
      return null;
    }),
  })
);

export const setTrackEpisodes = mutation(
  mutationHandler({
    args: sShow.mapFields(Struct.pick(["_id", "trackEpisodes"])),
    returns: S.Null,
    handler: E.fn(function* ({ _id, trackEpisodes }): E.fn.Return<null, S.SchemaError, MutationCtxDeps> {
      const { db } = yield* MutationCtx;
      yield* db.patch("shows", _id, { trackEpisodes });
      return null;
    }),
  })
);

export const upsert = mutation(
  mutationHandler({
    args: S.Struct({ dto: S.Union([sShowWithEpisodesCreate, sShowCreate]) }),
    returns: sId("shows"),
    handler: ({ dto }) => upsertShow(dto),
  })
);

// ACTIONS ---------------------------------------------------------------------------------------------------------------------------------
export const fetchManyMissingByPage = action(
  actionHandler({
    args: S.Struct({ page: S.Int }),
    returns: S.Null,
    handler: ({ page }): E.Effect<null, HttpClientError | S.SchemaError, ActionCtxDeps> =>
      E.gen(function* () {
        const { runMutation, scheduler } = yield* ActionCtx;
        const { fetchShowsByPage } = yield* TvMaze;
        const potentialMissingShows = yield* fetchShowsByPage(page);
        if (potentialMissingShows.length === 0) return yield* runMutation(api.fetcher.stop);
        let count = 0;
        const batches = Arr.chunksOf(potentialMissingShows, 25); // TODO: tune
        for (const batch of batches) count += yield* runMutation(api.shows.createManyMissing, { dtos: [...batch] });
        yield* runMutation(api.fetcher.update, { count, page });
        yield* scheduler.runAfter(0, api.shows.fetchManyMissingByPage, { page: page + 1 });
        return null;
      }).pipe(E.provide(TvMaze.layer)),
  })
);

export const refreshMissingOrStale = action(
  actionHandler({
    args: S.Struct({ revisions: S.Array(sShowRevision) }),
    returns: S.Null,
    handler: ({ revisions }): E.Effect<null, HttpClientError | S.SchemaError, ActionCtxDeps> =>
      E.gen(function* () {
        if (revisions.length === 0) return null;
        const { runMutation, runQuery } = yield* ActionCtx;
        const shows = yield* runQuery(api.shows.readMissingOrStale, { revisions });
        if (shows.length === 0) return null;
        const { fetchShow, fetchShowWithEpisodes } = yield* TvMaze;
        for (const { apiId, includeEpisodes } of shows) {
          const dto = includeEpisodes ? yield* fetchShowWithEpisodes(apiId) : yield* fetchShow(apiId);
          yield* runMutation(api.shows.upsert, { dto });
        }
        return null;
      }).pipe(E.provide(TvMaze.layer)),
  })
);

export const refreshAllDaily = action(
  actionHandler({
    args: S.Struct({}),
    returns: S.Null,
    handler: (): E.Effect<null, HttpClientError | S.SchemaError, ActionCtxDeps> =>
      E.gen(function* () {
        const { scheduler } = yield* ActionCtx;
        const { fetchShowRevisions } = yield* TvMaze;
        const revisions = yield* fetchShowRevisions("day");
        const batches = Arr.chunksOf(revisions, 100); // TODO: tune
        for (const [index, batch] of batches.entries())
          yield* scheduler.runAfter(index * 10_000, api.shows.refreshMissingOrStale, { revisions: [...batch] });
        return null;
      }).pipe(E.provide(TvMaze.layer)),
  })
);

export const refreshAllMonthly = action(
  actionHandler({
    args: S.Struct({}),
    returns: S.Null,
    handler: (): E.Effect<null, HttpClientError | S.SchemaError, ActionCtxDeps> =>
      E.gen(function* () {
        const { scheduler } = yield* ActionCtx;
        const { fetchShowRevisions } = yield* TvMaze;
        const revisions = yield* fetchShowRevisions("month");
        const batches = Arr.chunksOf(revisions, 100); // TODO: tune
        for (const [index, batch] of batches.entries())
          yield* scheduler.runAfter(index * 10_000, api.shows.refreshMissingOrStale, { revisions: [...batch] });
        return null;
      }).pipe(E.provide(TvMaze.layer)),
  })
);

// TYPES -----------------------------------------------------------------------------------------------------------------------------------
type AggregateShowsParams<Namespace, Key> = {
  DataModel: DataModel;
  Key: Key;
  Namespace?: Namespace;
  TableName: "shows";
};

// MIGRATIONS ------------------------------------------------------------------------------------------------------------------------------
export const migrations = new Migrations<DataModel>(components.migrations);
export const run = migrations.runner();

export const backfillAggregatesMigration = migrations.define({
  table: "shows",
  migrateOne: async (ctx, doc) => {
    // await favoriteShows.insertIfDoesNotExist(ctx, doc);
    // await trendingShows.insertIfDoesNotExist(ctx, doc);
    // await trendingShowsByYear.insertIfDoesNotExist(ctx, doc);
    // await topRatedShows.insertIfDoesNotExist(ctx, doc);
    // await topRatedShowsByYear.insertIfDoesNotExist(ctx, doc);
    // await topRatedShowsByPreference.insertIfDoesNotExist(ctx, doc);
    // await topRatedShowsByPreferenceAndYear.insertIfDoesNotExist(ctx, doc);
    await trendingShowsByPreference.insertIfDoesNotExist(ctx, doc);
    await trendingShowsByPreferenceAndYear.insertIfDoesNotExist(ctx, doc);
  },
});

export const runAggregateBackfill = migrations.runner(internal.shows.backfillAggregatesMigration);
