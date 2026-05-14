// @ts-nocheck
export interface TLSConfigOptions {
  verify?: boolean;
  cert?: string | Buffer;
  key?: string | Buffer;
  ca?: string | Buffer | Array<string | Buffer>;
  passphrase?: string;
  minVersion?: string;
  maxVersion?: string;
  sni?: string;
  ciphers?: string;
  alpnProtocols?: string[];
}

export interface UndiciConnectOptions {
  rejectUnauthorized?: boolean;
  cert?: string | Buffer;
  key?: string | Buffer;
  ca?: string | Buffer | Array<string | Buffer>;
  passphrase?: string;
  minVersion?: string;
  maxVersion?: string;
  servername?: string;
  ciphers?: string;
  ALPNProtocols?: string[];
}

export class TLSConfig {
  readonly verify: boolean;
  readonly cert?: string | Buffer;
  readonly key?: string | Buffer;
  readonly ca?: string | Buffer | Array<string | Buffer>;
  readonly passphrase?: string;
  readonly minVersion?: string;
  readonly maxVersion?: string;
  readonly sni?: string;
  readonly ciphers?: string;
  readonly alpnProtocols?: string[];

  constructor(options: TLSConfigOptions = {}) {
    this.verify = options.verify ?? true;
    if (options.cert !== undefined) this.cert = options.cert;
    if (options.key !== undefined) this.key = options.key;
    if (options.ca !== undefined) this.ca = options.ca;
    if (options.passphrase !== undefined) this.passphrase = options.passphrase;
    if (options.minVersion !== undefined) this.minVersion = options.minVersion;
    if (options.maxVersion !== undefined) this.maxVersion = options.maxVersion;
    if (options.sni !== undefined) this.sni = options.sni;
    if (options.ciphers !== undefined) this.ciphers = options.ciphers;
    if (options.alpnProtocols !== undefined) this.alpnProtocols = options.alpnProtocols;
  }

  get isMTLS(): boolean {
    return Boolean(this.cert && this.key);
  }

  toUndiciOptions(): UndiciConnectOptions {
    const out: UndiciConnectOptions = { rejectUnauthorized: this.verify };
    if (this.cert !== undefined) out.cert = this.cert;
    if (this.key !== undefined) out.key = this.key;
    if (this.ca !== undefined) out.ca = this.ca;
    if (this.passphrase !== undefined) out.passphrase = this.passphrase;
    if (this.minVersion !== undefined) out.minVersion = this.minVersion;
    if (this.maxVersion !== undefined) out.maxVersion = this.maxVersion;
    if (this.sni !== undefined) out.servername = this.sni;
    if (this.ciphers !== undefined) out.ciphers = this.ciphers;
    if (this.alpnProtocols !== undefined) out.ALPNProtocols = this.alpnProtocols;
    return out;
  }
}

export function createTLSConfig(input?: boolean | TLSConfigOptions): TLSConfig {
  if (input === undefined) return new TLSConfig();
  if (typeof input === 'boolean') return new TLSConfig({ verify: input });
  return new TLSConfig(input);
}
