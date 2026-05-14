// @ts-nocheck
import { z } from 'zod';

const semver = /^\d+\.\d+\.\d+(?:[-+].*)?$/;

function nowMillisIso(): string {
  const d = new Date();
  return d.toISOString();
}

export const VaultHeaderSchema = z.object({
  version: z.string().regex(semver).default('1.0.0'),
  createdAt: z.string().default(() => nowMillisIso()),
  description: z.string().optional(),
});
export type VaultHeader = z.infer<typeof VaultHeaderSchema>;

export const VaultFileSchema = z.object({
  header: VaultHeaderSchema,
  secrets: z.record(z.string(), z.string()),
});
export type VaultFile = z.infer<typeof VaultFileSchema>;

export interface LoadResult {
  totalVarsLoaded: number;
}
