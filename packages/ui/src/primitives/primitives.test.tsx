import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button, ButtonLink } from './button.js';
import { Chip } from './chip.js';
import { NumberStepper } from './number-stepper.js';
import { Slider } from './slider.js';
import { StepItem } from './step-item.js';
import { Switch } from './switch.js';
import { TextField } from './text-field.js';

describe('Button', () => {
  it('fires onPress from the keyboard and is a real button', async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Hitung modal</Button>);
    const button = screen.getByRole('button', { name: 'Hitung modal' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onPress).toHaveBeenCalledOnce();
    expect(button.className).toContain('min-h-11');
  });

  it('does nothing while disabled', async () => {
    const onPress = vi.fn();
    render(
      <Button isDisabled onPress={onPress}>
        Simpan
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('ButtonLink stays a link', () => {
    render(<ButtonLink href="/rencana">Lihat rencana</ButtonLink>);
    expect(screen.getByRole('link', { name: 'Lihat rencana' })).toHaveProperty(
      'href',
      expect.stringContaining('/rencana'),
    );
  });
});

describe('Chip', () => {
  it('toggles aria-pressed', async () => {
    const onChange = vi.fn();
    render(<Chip onChange={onChange}>Warteg</Chip>);
    const chip = screen.getByRole('button', { name: 'Warteg' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('NumberStepper', () => {
  it('is a labelled spinbutton with − and + buttons that respect bounds', async () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        label="Porsi per hari"
        unit="porsi"
        minValue={1}
        maxValue={3}
        defaultValue={3}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Porsi per hari' })).toBeDefined();
    expect(screen.getByText('porsi')).toBeDefined();
    const increase = screen.getAllByRole('button').at(-1);
    expect(increase?.hasAttribute('disabled') ?? increase?.getAttribute('aria-disabled')).toBe(
      true,
    );
    const decrease = screen.getAllByRole('button')[0];
    if (decrease !== undefined) await userEvent.click(decrease);
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe('Switch', () => {
  it('is a switch named by its text', async () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange}>Aktifkan peringatan</Switch>);
    await userEvent.click(screen.getByRole('switch', { name: 'Aktifkan peringatan' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Slider', () => {
  it('moves with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<Slider label="Kenaikan harga" defaultValue={10} step={5} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Kenaikan harga' });
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(15);
  });
});

describe('TextField', () => {
  it('ties the description to the input', () => {
    render(<TextField label="Nama menu" description="Contoh: Nasi Rames" />);
    const input = screen.getByRole('textbox', { name: 'Nama menu' });
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe('Contoh: Nasi Rames');
  });
});

describe('StepItem', () => {
  it('marks only the current step and names finished ones', () => {
    render(
      <ol>
        <StepItem index={1} label="Jenis warung" state="done" />
        <StepItem index={2} label="Menu & porsi" state="current" />
        <StepItem index={3} label="Peringatan" state="upcoming" />
      </ol>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(items[0]?.textContent).toContain('(selesai)');
  });
});

describe('optional field parts', () => {
  it('renders a stepper without a unit and a text field without a description', () => {
    render(
      <>
        <NumberStepper label="Takaran" defaultValue={10} />
        <NumberStepper label="Harga" defaultValue={15000} isWide />
        <TextField label="Harga jual" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Takaran' })).toBeDefined();
    expect(
      screen.getByRole('textbox', { name: 'Harga jual' }).getAttribute('aria-describedby'),
    ).toBeNull();
  });
});
