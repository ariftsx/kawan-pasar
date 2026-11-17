import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommodityFilter } from './CommodityFilter';

function setup() {
  return render(
    <>
      <CommodityFilter targetId="list" total={3} covered={2} search />
      <ul id="list">
        <li data-name="cabai merah keriting" data-coverage="covered">
          Cabai merah keriting
        </li>
        <li data-name="bawang merah" data-coverage="covered">
          Bawang merah
        </li>
        <li data-name="cabai rawit hijau" data-coverage="pending">
          Cabai rawit hijau
        </li>
      </ul>
    </>,
  );
}

describe('CommodityFilter search', () => {
  it('says so when no commodity matches, in a status message, and clears it again', () => {
    setup();
    const input = screen.getByRole('searchbox', { name: 'Cari komoditas' });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');

    fireEvent.change(input, { target: { value: 'jagung' } });
    expect(status.textContent).toBe('Tidak ada komoditas yang cocok dengan “jagung”.');

    fireEvent.change(input, { target: { value: 'cabai' } });
    expect(status.textContent).toBe('');
  });

  it('counts the coverage tab too: a match that the tab hides is no match', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Bisa diprediksi (2)' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cari komoditas' }), {
      target: { value: 'rawit' },
    });
    expect(screen.getByRole('status').textContent).toBe(
      'Tidak ada komoditas yang cocok dengan “rawit”.',
    );
  });
});
