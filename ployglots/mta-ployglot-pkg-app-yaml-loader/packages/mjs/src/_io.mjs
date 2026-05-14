import * as fs from 'node:fs/promises';

// Mutable indirection so tests can spy on `readFile` via `mock.method(io, 'readFile')`.
export const io = {
  readFile: (p, enc) => fs.readFile(p, enc),
};
