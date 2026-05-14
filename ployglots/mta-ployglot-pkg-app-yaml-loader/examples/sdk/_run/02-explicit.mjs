import { loadFiles } from '@ployglot/app-yaml-loader';

const map = await loadFiles(
  ['./examples/fixtures/explicit/a.yml',
   './examples/fixtures/explicit/b.yml',
   './examples/fixtures/explicit/c.yml'],
  { missing: 'skip', logger: console },
);

console.log('keys:', Array.from(map.keys()).map((p) => p.split('/').pop()));
