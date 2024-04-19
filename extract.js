const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');

function sanitizeName(name) {
  return name.replace(/"/g, '').replace(/:/g, '');
}

function unzipFile(file, target) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, {lazyEntries: true}, (err, zipfile) => {
      if (err) reject(err);

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const sanitizedFileName = sanitizeName(entry.fileName);
        const filePath = path.join(target, sanitizedFileName);
        if (/\/$/.test(entry.fileName)) { // Directory
          fs.mkdir(filePath, {recursive: true}, (err) => {
            if (err) reject(err);
            zipfile.readEntry();
          });
        } else { // File
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) reject(err);
            fs.mkdir(path.dirname(filePath), {recursive: true}, (err) => {
              if (err) reject(err);
              readStream.pipe(fs.createWriteStream(filePath));
              readStream.on('end', () => {
                zipfile.readEntry();
              });
            });
          });
        }
      });

      zipfile.once('end', () => resolve());
    });
  });
}

async function extractZipFiles(directory) {
  let entries = fs.readdirSync(directory, { withFileTypes: true });

  for (let entry of entries) {
    let fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await extractZipFiles(fullPath);
    }
    else if (entry.isFile() && path.extname(fullPath) === '.zip') {
      let outputDir = path.join(directory, path.basename(entry.name, '.zip'));

      if (outputDir.length > 240) { // Path length check
        console.error('Path is too long, skipping file:', fullPath);
        continue;
      }

      try {
        await unzipFile(fullPath, outputDir);
        fs.unlinkSync(fullPath);
        await extractZipFiles(outputDir);
      }
      catch (err) {
        console.error('Failed to extract zip:', fullPath, 'Error:', err);
      }
    }
  }
}

let workingDir = __dirname; // Current script directory
extractZipFiles(workingDir);
