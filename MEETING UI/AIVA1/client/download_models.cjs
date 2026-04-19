const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

async function download(file) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(modelsDir, file);
    const fileStream = fs.createWriteStream(filePath);
    https.get(baseUrl + file, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get '${file}' (${res.statusCode})`));
        return;
      }
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

async function run() {
  for (const file of files) {
    console.log(`Downloading ${file}...`);
    try {
      await download(file);
      console.log(`Successfully downloaded ${file}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}

run();
