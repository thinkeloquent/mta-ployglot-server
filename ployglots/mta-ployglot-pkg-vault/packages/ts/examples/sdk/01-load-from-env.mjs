import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create().withEnvPath('.env').build();
const result = sdk.loadConfig();
if (!result.success) {
  console.error('load failed:', result.error);
  process.exit(1);
}
console.log(JSON.stringify(result.data));
