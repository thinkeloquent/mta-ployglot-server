import { loadFromConfigDir } from '@ployglot/app-yaml-loader';

const map = await loadFromConfigDir({
  configDir: './examples/fixtures/canonical',
  appEnv: 'test',
});

for (const [path, parsed] of map.entries()) {
  console.log(path, '→', Object.keys(parsed).slice(0, 3));
}
