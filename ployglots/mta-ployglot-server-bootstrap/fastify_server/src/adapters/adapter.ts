// @ts-nocheck
import type { BootstrapConfig, HookFn, ResolvedBootstrapConfig } from "../contract/index.js";

export interface ScheduledHooks<Server> {
  startup: HookFn<Server>[];
  shutdown: HookFn<Server>[];
}

export interface RuntimeAdapter<Server = unknown> {
  readonly name: string;
  createServer(config: ResolvedBootstrapConfig): Promise<Server> | Server;
  decorate(server: Server, key: string, value: unknown): void;
  hasDecorator(server: Server, key: string): boolean;
  onClose(server: Server, fn: () => void | Promise<void>): void;
  attachRequestState(server: Server, initialState: Record<string, unknown>): void;
  registerGracefulShutdown(server: Server): void;
  scheduleHooks(server: Server, hooks: ScheduledHooks<Server>, config: ResolvedBootstrapConfig): void;
  registerRoutes(
    server: Server,
    fn: (server: Server, config: BootstrapConfig) => void | Promise<void>,
  ): void | Promise<void>;
}
