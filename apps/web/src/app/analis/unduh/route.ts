import { connection } from 'next/server';

import { boardCsv } from '@/lib/market/board';
import { currentBoard } from '@/lib/market/server';

/** CSV of the price board for Mode Analis. Demo rows are marked DATA DEMO in the source column. */
export async function GET(): Promise<Response> {
  await connection();
  const board = currentBoard();
  const name = board.status === 'demo' ? `kawan-pasar_${board.asOf}_demo.csv` : 'kawan-pasar.csv';
  return new Response(boardCsv(board), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}
