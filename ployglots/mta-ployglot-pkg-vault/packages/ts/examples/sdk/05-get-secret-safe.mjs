import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create()
  .withEnvPath('packages/ts/tests/fixtures/.env.mixed')
  .build();
sdk.loadConfig();
console.log('known:', JSON.stringify(sdk.getSecretSafe('SHARED')));
console.log('missing:', JSON.stringify(sdk.getSecretSafe('NOT_PRESENT')));
