import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('starts hidden and toggles visibility with a labelled, pressed-state button', () => {
    render(
      <PasswordField id="pw" name="password" label="Kata sandi" autoComplete="new-password" />,
    );
    const input = screen.getByLabelText('Kata sandi');
    expect(input.getAttribute('type')).toBe('password');
    const toggle = screen.getByRole('button', { name: 'Tampilkan kata sandi' });
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('pw');

    fireEvent.click(toggle);
    expect(input.getAttribute('type')).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Sembunyikan kata sandi');

    fireEvent.click(toggle);
    expect(input.getAttribute('type')).toBe('password');
  });

  it('keeps the field wiring of TextField (error, hint, autocomplete)', () => {
    render(
      <PasswordField
        id="pw"
        name="password"
        label="Kata sandi"
        autoComplete="current-password"
        hint="Minimal 12 karakter."
        error="Kedua kata sandi tidak sama."
      />,
    );
    const input = screen.getByLabelText('Kata sandi');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(input.getAttribute('aria-describedby')).toBe('pw-error pw-hint');
  });
});
