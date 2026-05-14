import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create().build();
const r = sdk.validateFile(process.argv[2] ?? '/tmp/missing.env');
console.log(JSON.stringify(r.data, null, 2));
