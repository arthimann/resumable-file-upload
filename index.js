const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = 8080;
const CHUNK_SIZE = 1024 * 1024;

const getProgress = async () => {
    const file = await fs.open('progress.json', 'r');
    const content = await file.readFile('utf-8');
    const data = content && JSON.parse(content);
    file.close();
    return data?.bytes || 0;
};

const setProgress = async (bytes) => {
    try {
        const file = await fs.open('progress.json', 'w');
        await file.writeFile(JSON.stringify({ bytes }), 'utf-8');
        file.close();
    } catch (e) {
        console.log('Failed to save the progress', e.message);
    }
};

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/upload') {
        const srcFile = await fs.open(path.join(__dirname, 'lorem.txt'), 'r');
        const destFile = await fs.open(path.join(__dirname, 'dest.txt'), 'w');

        const startSize = await getProgress();
        const totalSize = await srcFile.stat();

        if (startSize === totalSize.size) {
            return res.end(
                JSON.stringify({
                    message: 'The file already copied',
                }),
            );
        }

        const readStream = srcFile.createReadStream({
            start: startSize,
            highWaterMark: CHUNK_SIZE,
        });
        const writeStream = destFile.createWriteStream({
            start: startSize,
        });

        let bytesCopied = startSize;
        let lastSaved = startSize;
        readStream.on('data', async (chunk) => {
            bytesCopied += chunk.length;

            writeStream.write(chunk);

            if (bytesCopied - lastSaved >= CHUNK_SIZE) {
                await setProgress(bytesCopied);
                lastSaved = bytesCopied;
            }
        });

        const closeFiles = () => {
            srcFile.close();
            destFile.close();
        };

        readStream.on('error', () => {
            console.error('Error reading stream');
            closeFiles();
        });

        readStream.on('end', () => {
            console.log('Done!');
            closeFiles();
        });
    }

    res.end('');
});

server.listen(PORT, () => {
    console.log(`The server is running on http://localhost${PORT}`);
});
