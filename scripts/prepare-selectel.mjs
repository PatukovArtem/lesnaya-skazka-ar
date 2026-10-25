import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const distDirectory = resolve('dist');
const releaseDirectory = resolve('release/selectel');
const requiredFiles = [
  'index.html',
  'markers/story-targets.mind',
];

function countFiles(directory, extension) {
  let count = 0;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      count += countFiles(entryPath, extension);
    } else if (entry.name.endsWith(extension)) {
      count += 1;
    }
  }

  return count;
}

if (!existsSync(distDirectory)) {
  throw new Error('Папка dist не найдена. Сначала запустите npm run build.');
}

for (const file of requiredFiles) {
  if (!existsSync(resolve(distDirectory, file))) {
    throw new Error(`В сборке отсутствует обязательный файл: ${file}`);
  }
}

const videoDirectory = resolve(distDirectory, 'media/stories');
const markerDirectory = resolve(distDirectory, 'markers/stories');

if (!existsSync(videoDirectory) || !existsSync(markerDirectory)) {
  throw new Error('В сборке отсутствуют папки с видео или иллюстрациями.');
}

const videoCount = countFiles(videoDirectory, '.mp4');
const markerCount = countFiles(markerDirectory, '.jpg') + countFiles(markerDirectory, '.png');

if (videoCount === 0 || markerCount === 0) {
  throw new Error('В сборке не найдены видео или иллюстрации для распознавания.');
}

rmSync(releaseDirectory, { recursive: true, force: true });
mkdirSync(releaseDirectory, { recursive: true });
cpSync(distDirectory, releaseDirectory, { recursive: true });

const totalSize = statSync(resolve(releaseDirectory, 'index.html')).size;
console.log(`Пакет Selectel готов: ${releaseDirectory}`);
console.log(`Проверено: ${videoCount} видео, ${markerCount} иллюстраций, файл индекса ${totalSize} байт.`);
console.log('Загрузите содержимое этой папки в корень публичного S3-бакета Selectel.');
