import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create().withEnvPath(process.argv[2] ?? '.env').build();
sdk.loadConfig();
const r = sdk.describeConfig();
console.log(JSON.stringify(r.data, null, 2));
