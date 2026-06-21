import { TableAggregate } from "@convex-dev/aggregate";
import { getYear } from "date-fns";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

type AggregateShowsParams<Namespace, Key> = {
  DataModel: DataModel;
  Key: Key;
  Namespace?: Namespace;
  TableName: "shows";
};

export const favoriteShows = new TableAggregate<AggregateShowsParams<boolean, string>>(components.favoriteShows, {
  namespace: ({ preference }) => {
    if (preference === "favorite") return true;
  },
  sortKey: ({ name }) => name,
});

export const topRatedShows = new TableAggregate<AggregateShowsParams<boolean, number>>(components.topRatedShows, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && premiered) return true;
  },
  sortKey: ({ rating }) => -rating,
});

export const topRatedShowsByYear = new TableAggregate<AggregateShowsParams<number, number>>(components.topRatedShowsByYear, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && premiered) return getYear(premiered);
  },
  sortKey: ({ rating }) => -rating,
});

export const topRatedShowsByPreference = new TableAggregate<AggregateShowsParams<string, [number, string]>>(
  components.topRatedShowsByPreference,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && premiered && preference) return preference;
    },
    sortKey: ({ rating, name }) => [-rating, name],
  }
);

export const topRatedShowsByPreferenceAndYear = new TableAggregate<AggregateShowsParams<string, [number, string]>>(
  components.topRatedShowsByPreferenceAndYear,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && premiered && preference) return `${preference}-${getYear(premiered)}`;
    },
    sortKey: ({ rating, name }) => [-rating, name],
  }
);

export const trendingShows = new TableAggregate<AggregateShowsParams<boolean, [number, number]>>(components.trendingShows, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && premiered) return true;
  },
  sortKey: ({ rating, weight }) => [-weight, -rating],
});

export const trendingShowsByYear = new TableAggregate<AggregateShowsParams<number, [number, number]>>(components.trendingShowsByYear, {
  namespace: ({ premiered, rating }) => {
    if (rating > 0 && premiered) return getYear(premiered);
  },
  sortKey: ({ rating, weight }) => [-weight, -rating],
});

export const trendingShowsByPreference = new TableAggregate<AggregateShowsParams<string, [number, number, string]>>(
  components.trendingShowsByPreference,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && premiered && preference) return preference;
    },
    sortKey: ({ rating, weight, name }) => [-weight, -rating, name],
  }
);

export const trendingShowsByPreferenceAndYear = new TableAggregate<AggregateShowsParams<string, [number, number, string]>>(
  components.trendingShowsByPreferenceAndYear,
  {
    namespace: ({ preference, premiered, rating }) => {
      if (rating > 0 && premiered && preference) return `${preference}-${getYear(premiered)}`;
    },
    sortKey: ({ rating, weight, name }) => [-weight, -rating, name],
  }
);
