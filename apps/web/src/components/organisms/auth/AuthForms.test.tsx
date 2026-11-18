import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FormState } from '@/lib/auth/form-state';
import { TextField } from '../../atoms/TextField';
import { FormMessage } from '../../molecules/FormMessage';
import { LoginForm, RegisterForm } from './AuthForms';

const noop = (s: FormState): Promise<FormState> => Promise.resolve(s);

describe('TextField', () => {
  it('labels the input and links its error for assistive technology', () => {
    render(
      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        error="Masukkan alamat email yang valid."
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe(
      'Masukkan alamat email yang valid.',
    );
    expect(input.getAttribute('autocomplete')).toBe('email');
  });

  it('has no error wiring without an error', () => {
    render(<TextField id="x" name="x" label="Nama" />);
    const input = screen.getByLabelText('Nama');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('FormMessage', () => {
  it('announces errors as alerts and confirmations as status', () => {
    const { rerender } = render(<FormMessage state={{ status: 'error', message: 'Gagal.' }} />);
    expect(screen.getByRole('alert').textContent).toBe('Gagal.');
    rerender(<FormMessage state={{ status: 'done', message: 'Terkirim.' }} />);
    expect(screen.getByRole('status').textContent).toBe('Terkirim.');
  });
});

describe('LoginForm', () => {
  it('has e-mail and current-password fields, the return target, and a submit button', () => {
    render(<LoginForm action={noop} next="/akun" />);
    expect(screen.getByLabelText('Email').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText('Kata sandi').getAttribute('autocomplete')).toBe(
      'current-password',
    );
    const ke = document.querySelector<HTMLInputElement>('input[name="ke"]');
    expect(ke?.type).toBe('hidden');
    expect(ke?.value).toBe('/akun');
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeDefined();
  });
});

describe('RegisterForm', () => {
  it('asks for a new password (with its rule) and the privacy consent', () => {
    render(<RegisterForm action={noop} />);
    const pw = screen.getByLabelText('Kata sandi');
    expect(pw.getAttribute('autocomplete')).toBe('new-password');
    expect(pw.getAttribute('minlength')).toBe('12');
    expect(document.getElementById(pw.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(
      /minimal 12 karakter/i,
    );
    const consent = screen.getByRole('checkbox');
    expect(consent.getAttribute('name')).toBe('acceptPrivacy');
    expect(screen.getByRole('link', { name: 'kebijakan privasi' }).getAttribute('href')).toBe(
      '/privasi',
    );
  });
});
