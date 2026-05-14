// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { HooksManager, createHooksManager } from './hooks.js';
import { Request } from '../models/request.js';
import { Response } from '../models/response.js';

const req = (): Request => new Request('GET', 'http://x.test/p');
const resp = (): Response => new Response({ statusCode: 200 });

describe('HooksManager', () => {
  it('default ctor → empty hook lists', () => {
    const m = new HooksManager();
    expect(m.requestHookCount).toBe(0);
    expect(m.responseHookCount).toBe(0);
  });

  it('config: single hook (not array) is wrapped', () => {
    const m = new HooksManager({ onRequest: () => {}, onResponse: () => {} });
    expect(m.requestHookCount).toBe(1);
    expect(m.responseHookCount).toBe(1);
  });

  it('config: array of hooks preserved', () => {
    const m = new HooksManager({
      onRequest: [() => {}, () => {}, () => {}],
      onResponse: [() => {}, () => {}],
    });
    expect(m.requestHookCount).toBe(3);
    expect(m.responseHookCount).toBe(2);
  });

  it('addRequestHook / addResponseHook append', () => {
    const m = new HooksManager();
    m.addRequestHook(() => {});
    m.addResponseHook(() => {});
    expect(m.requestHookCount).toBe(1);
    expect(m.responseHookCount).toBe(1);
  });

  it('callRequestHooks fires in registration order', async () => {
    const order: number[] = [];
    const m = new HooksManager();
    m.addRequestHook(() => {
      order.push(1);
    });
    m.addRequestHook(() => {
      order.push(2);
    });
    m.addRequestHook(() => {
      order.push(3);
    });
    await m.callRequestHooks(req());
    expect(order).toEqual([1, 2, 3]);
  });

  it('callResponseHooks fires in order, awaits async hooks', async () => {
    const order: number[] = [];
    const m = new HooksManager();
    m.addResponseHook(async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push(1);
    });
    m.addResponseHook(() => {
      order.push(2);
    });
    await m.callResponseHooks(resp());
    expect(order).toEqual([1, 2]);
  });

  it('throwing hook aborts the chain — subsequent hooks NOT called', async () => {
    const m = new HooksManager();
    let secondCalled = false;
    m.addRequestHook(() => {
      throw new Error('nope');
    });
    m.addRequestHook(() => {
      secondCalled = true;
    });
    await expect(m.callRequestHooks(req())).rejects.toThrow('nope');
    expect(secondCalled).toBe(false);
  });

  it('removeRequestHook returns true for existing, false for missing', () => {
    const m = new HooksManager();
    const fn = (): void => {};
    m.addRequestHook(fn);
    expect(m.removeRequestHook(fn)).toBe(true);
    expect(m.removeRequestHook(fn)).toBe(false);
  });

  it('removeResponseHook returns true for existing, false for missing', () => {
    const m = new HooksManager();
    const fn = (): void => {};
    m.addResponseHook(fn);
    expect(m.removeResponseHook(fn)).toBe(true);
    expect(m.removeResponseHook(fn)).toBe(false);
  });

  it('createHooksManager factory', () => {
    expect(createHooksManager({ onRequest: () => {} })).toBeInstanceOf(HooksManager);
    expect(createHooksManager()).toBeInstanceOf(HooksManager);
  });
});
