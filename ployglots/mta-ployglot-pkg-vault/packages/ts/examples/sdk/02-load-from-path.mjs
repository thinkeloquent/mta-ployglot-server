import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create().build();
const r = sdk.loadFromPath(process.argv[2] ?? './.env');
console.log(r.success ? JSON.stringify(r.data) : r.error);
