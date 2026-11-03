import type { Route } from 'next';

/** Typed routes cannot see query strings; this keeps the cast in one reviewed place. */
export function withQuery(path: string, query: Record<string, string>): Route {
  const search = new URLSearchParams(query).toString();
  return search === '' ? path : `${path}?${search}`;
}

/** First value of a Next.js search param. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
