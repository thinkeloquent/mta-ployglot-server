// @ts-nocheck
export interface SDKConfig {
  bucketName?: string;
  region: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  endpointUrl?: string;
  forcePathStyle: boolean;
  proxyUrl?: string;
  connectTimeout: number;
  readTimeout: number;
  maxRetries: number;
  verifySsl: boolean;
}

export interface YamlStorageS3Config {
  bucket_name?: string;
  region_name?: string;
  endpoint_url?: string;
  access_key_id?: string;
  secret_access_key?: string;
  force_path_style?: boolean;
  proxy_url?: string | null;
  verify_ssl?: boolean;
  connect_timeout?: number;
  read_timeout?: number;
  max_retries?: number;
}

export const DEFAULT_SDK_CONFIG: SDKConfig = {
  region: "us-east-1",
  forcePathStyle: false,
  connectTimeout: 10,
  readTimeout: 60,
  maxRetries: 3,
  verifySsl: false,
};

export interface ValidateOptions {
  requireBucket?: boolean;
}

export function validateConfig(cfg: SDKConfig, opts?: ValidateOptions): string[] {
  const errors: string[] = [];
  if ((opts?.requireBucket ?? true) && !cfg.bucketName) {
    errors.push("bucketName is required");
  }
  if (cfg.endpointUrl && !/^https?:\/\//.test(cfg.endpointUrl)) {
    errors.push(`endpointUrl must start with http:// or https://: ${cfg.endpointUrl}`);
  }
  if (cfg.proxyUrl && !/^https?:\/\//.test(cfg.proxyUrl)) {
    errors.push(`proxyUrl must start with http:// or https://: ${cfg.proxyUrl}`);
  }
  return errors;
}

export function assertValidConfig(cfg: SDKConfig, opts?: ValidateOptions): void {
  const errs = validateConfig(cfg, opts);
  if (errs.length) {
    throw new Error(`Invalid S3 config: ${errs.join("; ")}`);
  }
}
