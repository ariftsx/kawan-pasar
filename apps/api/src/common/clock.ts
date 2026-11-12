export const CLOCK = Symbol('CLOCK');

/** Source of "now". Injected so time-dependent product rules are testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
