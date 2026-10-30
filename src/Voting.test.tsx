// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Voting from './Voting';
import raw from './data/tournament.json';
import type { Tournament } from './types';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
it('limits the draft to three teams and announces success only after the server saves', async () => {
  const data = raw as Tournament;
  const ranking = data.grades.map((g) => ({ team_id: g.id, votes: 0 }));
  const fetchMock = vi.fn(async (_url: unknown, options?: RequestInit) => {
    const ids = options?.method === 'PUT' ? JSON.parse(String(options.body)).team_ids : [];
    return new Response(JSON.stringify({ ranking, my_votes: ids, voters: ids.length ? 1 : 0 }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<Voting data={data} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /Votar y ver ranking/ }));
  const boxes = await screen.findAllByRole('checkbox');
  fireEvent.click(boxes[0]);fireEvent.click(boxes[1]);fireEvent.click(boxes[2]);fireEvent.click(boxes[3]);
  expect(screen.getByText('3 de 3 seleccionados')).toBeTruthy();
  expect((boxes[3] as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /Guardar mis votos/ }));
  await screen.findByText(/Tus votos están guardados/);
  const write = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT');
  expect(JSON.parse(String(write?.[1]?.body)).team_ids).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Pausar movimiento de votaciones' }));
  expect(screen.getByRole('button', { name: 'Reanudar movimiento de votaciones' }).getAttribute('aria-pressed')).toBe('true');
});
