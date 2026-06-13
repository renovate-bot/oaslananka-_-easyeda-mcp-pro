import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = join(__dirname, '..');
const output = createWriteStream(join(root, '..', 'easyeda-bridge-extension.eext'));
const archive = new ZipArchive({ zlib: { level: 9 } });

archive.pipe(output);
archive.file(join(root, 'extension.json'), { name: 'extension.json' });
archive.directory(join(root, 'dist'), 'dist');
archive.directory(join(root, 'images'), 'images');
archive.directory(join(root, 'locales'), 'locales');

output.on('close', () => {
  console.log(`Package ready: ${archive.pointer()} bytes`);
  console.log('File: easyeda-bridge-extension.eext');
});
archive.finalize();
