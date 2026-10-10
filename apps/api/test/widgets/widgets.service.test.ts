import type { WidgetMeta } from '@youscan/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../src/http/errors.js';
import { RandomDataService } from '../../src/widgets/random-data.service.js';
import { CorruptedWidgetDataError, WidgetsRepository } from '../../src/widgets/widgets.repository.js';
import { WidgetsService } from '../../src/widgets/widgets.service.js';

const ID = '11111111-1111-4111-8111-111111111111';
const META: WidgetMeta = { id: ID, type: 'TEXT', title: 'Note', updatedAt: '2026-01-01T00:00:00.000Z' };

const logger = { error: vi.fn() };

/** A repository whose methods are replaced by the given stubs; nothing touches a database. */
function serviceWith(stubs: Partial<Pick<WidgetsRepository, 'findPayload' | 'findMeta' | 'updatePayload'>>) {
  const repository: WidgetsRepository = Object.create(WidgetsRepository.prototype);
  Object.assign(repository, stubs);
  return new WidgetsService(repository, new RandomDataService(), logger);
}

const withStatus = (status: number) => expect.objectContaining({ name: 'HttpError', status });

describe('WidgetsService', () => {
  afterEach(() => vi.clearAllMocks());

  describe('getData', () => {
    it('returns the payload with the widget id', async () => {
      const service = serviceWith({ findPayload: async () => ({ type: 'TEXT', data: { text: 'hi' } }) });
      await expect(service.getData(ID)).resolves.toEqual({ id: ID, type: 'TEXT', data: { text: 'hi' } });
    });

    it('returns 404 for a missing widget', async () => {
      const service = serviceWith({ findPayload: async () => null });
      await expect(service.getData(ID)).rejects.toEqual(withStatus(404));
    });

    it('logs the widget id, the issues and the stack, and answers with a safe 500', async () => {
      const issues = [{ path: ['data', 'slices'], message: 'Expected array' }];
      const corrupted = new CorruptedWidgetDataError(ID, issues);
      const service = serviceWith({ findPayload: async () => Promise.reject(corrupted) });

      const error = await service.getData(ID).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 500, message: 'Widget data is corrupted', issues: undefined });
      expect(logger.error).toHaveBeenCalledTimes(1);
      const [message, stack] = logger.error.mock.calls[0]!;
      expect(message).toContain(ID);
      expect(message).toContain(JSON.stringify(issues));
      expect(stack).toBe(corrupted.stack);
    });

    it('rethrows unexpected repository errors unchanged, without logging them as corruption', async () => {
      const failure = new Error('connection lost');
      const service = serviceWith({ findPayload: async () => Promise.reject(failure) });

      await expect(service.getData(ID)).rejects.toBe(failure);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('updateText', () => {
    it('returns the metadata of the updated widget', async () => {
      const service = serviceWith({ updatePayload: async () => META });
      await expect(service.updateText(ID, 'hello')).resolves.toBe(META);
    });

    it('answers 422 when the widget exists but is not a text widget', async () => {
      const service = serviceWith({ updatePayload: async () => null, findMeta: async () => ({ ...META, type: 'PIE' }) });
      await expect(service.updateText(ID, 'hello')).rejects.toEqual(withStatus(422));
    });

    it('answers 404 when the widget does not exist', async () => {
      const service = serviceWith({ updatePayload: async () => null, findMeta: async () => null });
      await expect(service.updateText(ID, 'hello')).rejects.toEqual(withStatus(404));
    });
  });
});
