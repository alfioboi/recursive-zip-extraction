const fs = require('fs');
const path = require('path');
const { unzipSync } = require('fflate');
const {createInterface} = require("node:readline");

function sanitizeName(name) {
    return name.replace(/"/g, '').replace(/:/g, '');
}

async function unzipFile(file, target) {
    await fs.promises.mkdir(target, { recursive: true });

    const data = fs.readFileSync(file);
    const files = unzipSync(data); // fflate è tollerante, niente Z_BUF_ERROR

    for (const [name, content] of Object.entries(files)) {
        const sanitized = sanitizeName(name);
        const filePath = path.join(target, sanitized);

        if (sanitized.endsWith('/')) {
            await fs.promises.mkdir(filePath, { recursive: true });
        } else {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content);
        }
    }
}

async function extractZipFiles(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (let entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            await extractZipFiles(fullPath);
        }
        else if (entry.isFile() && path.extname(fullPath) === '.zip') {
            const outputDir = path.join(directory, path.basename(entry.name, '.zip'));

            if (outputDir.length > 240) {
                console.error('Path is too long, skipping file:', fullPath);
                continue;
            }

            try {
                await unzipFile(fullPath, outputDir);
                fs.unlinkSync(fullPath);
                await extractZipFiles(outputDir);
            } catch (err) {
                console.error('Failed to extract zip:', fullPath, 'Error:', err);
            }
        }
    }
}
function ask(question) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer);
        });
    });
}
async function askUserParams() {
    const file = await ask("Percorso del file ZIP: ");
    return { file };
}
function cleanPath(p) {
    return p.trim().replace(/^"(.*)"$/, "$1");
}
(async () => {
    const file = cleanPath(await ask("Percorso del file ZIP: "));
    const target = path.join(path.dirname(file), path.basename(file, '.zip'));

    await unzipFile(file, target);
    await extractZipFiles(target);
})();

