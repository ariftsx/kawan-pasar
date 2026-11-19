'use client';

import { useState, useSyncExternalStore } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { EyeIcon } from '@/brand/EyeIcon';
import { TextField } from './TextField';

const noSubscription = (): (() => void) => () => undefined;

/** False in the server HTML and during hydration, true once React runs in the browser. */
const useHydrated = (): boolean =>
  useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

type Props = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>;

/**
 * Password input with a show/hide button, so people can check what they typed. Progressive
 * enhancement: the button appears only once JavaScript runs (without it the field stays a
 * plain hidden password field, nothing dead on the page). The input keeps `type="password"`
 * whenever it is not explicitly shown, so browsers and password managers treat it as one.
 */
export function PasswordField(props: Props): ReactNode {
  const ready = useHydrated();
  const [shown, setShown] = useState(false);
  const label = shown ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi';
  return (
    <TextField
      {...props}
      type={shown ? 'text' : 'password'}
      {...(shown ? { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } : {})}
      {...(ready
        ? {
            trailing: (
              <button
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={shown}
                aria-controls={props.id}
                onClick={() => {
                  setShown((s) => !s);
                }}
                className="flex size-11 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green-900"
              >
                <EyeIcon open={!shown} size={22} />
              </button>
            ),
          }
        : {})}
    />
  );
}
