const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const url = require('url');
const puppeteer = require('puppeteer');
const env = require('dotenv');
const pm2 = require('pm2');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
env.config();

const minimal_args = [
  '--autoplay-policy=user-gesture-required',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-domain-reliability',
  '--disable-extensions',
  '--disable-features=AudioServiceOutOfProcess',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-notifications',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-speech-api',
  '--disable-sync',
  '--hide-scrollbars',
  '--ignore-gpu-blacklist',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-first-run',
  '--no-pings',
  '--no-zygote',
  '--password-store=basic',
  '--use-gl=swiftshader',
  '--use-mock-keychain',
];

const wss = new WebSocket.Server({ port: process.env.VITE_WS_PORT });
console.log(`WebSocket server started on port ${process.env.VITE_WS_PORT}`);
const PORT = process.env.VITE_RPC_PORT;

let connectedClient = null;
let puppeteerPage = null;
let LOGSARRAY = [];

function pushToLimitedArray(arr, item, limit = 1000) {
  if (arr.length >= limit) {
    arr.shift(); // Remove the first element
  }
  arr.push(item);
  return arr;
}
wss.on('connection', (ws) => {
  console.log(
    `WebSocket client connection received. Ready to receive RPC requests at http://127.0.0.1:${PORT}/rpc`,
  );
  connectedClient = ws;

  // ws.on('message', (message, isBinary) => {
  //   message = isBinary ? message : message.toString();
  //   console.log('Received message:', message);
  //   ws.send(message);
  // });

  connectedClient.on('message', (message) => {
    const receivedMessage = message.toString();
    const receivedMessageObj = JSON.parse(receivedMessage);
    if (receivedMessageObj.logObject && receivedMessageObj.logObject.line) {
      pushToLimitedArray(LOGSARRAY, receivedMessageObj, process.env.VITE_LOGS_LIMIT);
      fs.appendFileSync(
        'mm2.log',
        receivedMessageObj.logObject.time + receivedMessageObj.logObject.line + '\n',
      );
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    connectedClient = null;
  });
});

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  if (req.method === 'GET') {
    if (parsedUrl.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'success',
          message: {
            rpc_server_running: true,
            ws_client_connected:
              connectedClient && connectedClient.readyState === WebSocket.OPEN ? true : false,
          },
        }),
      );
    } else if (parsedUrl.pathname === '/logs') {
      const query = parsedUrl.query;
      const limit = query.limit ? parseInt(query.limit, 10) : LOGSARRAY.length;

      const logsToReturn = LOGSARRAY.slice(-limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', message: logsToReturn }));
    }
  } else if (req.method === 'POST') {
    if (parsedUrl.pathname === '/admin') {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        body = JSON.parse(body);
        if (body.action === 'reload_kdf_page' && body.mm2_conf) {
          const encoded_mm2_conf = btoa(JSON.stringify(body.mm2_conf));
          // console.log(encoded_mm2_conf)
          puppeteerPage.goto(
            `http://127.0.0.1:${process.env.VITE_WEB_PORT}/?mm2_conf=${encoded_mm2_conf}`,
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', action: 'reload_kdf_page' }));
        } else if (body.action === 'reload_kdf_page') {
          puppeteerPage.reload();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', action: 'reload_kdf_page' }));
        } else if (body.action === 'restart_kdf') {
          if (connectedClient && connectedClient.readyState === WebSocket.OPEN) {
            const uuid = uuidv4();
            const message = JSON.stringify({
              action: 'restart_kdf',
              mm2_conf: body.mm2_conf,
              uuid: uuid,
            });

            connectedClient.send(message);
            connectedClient.on('message', (message) => {
              const receivedMessage = message.toString();
              const receivedMessageObj = JSON.parse(receivedMessage);
              if (receivedMessageObj.response && receivedMessageObj.uuid === uuid) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', action: receivedMessage.action }));
              }
            });
          } else {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                status: 'error',
                message: 'Webpage running KDF is not connected to websocket',
              }),
            );
          }
        } else if (body.action === 'update_wasm_lib') {
          const wasm_lib_url = body.wasm_lib_url;
          const zipfile_name = wasm_lib_url.split('/').pop();
          const kdf_zips_dir = path.join(__dirname, 'kdf_zips');

          // Ensure kdf_zips directory exists
          if (!fs.existsSync(kdf_zips_dir)) {
            fs.mkdirSync(kdf_zips_dir);
          }

          fetch(wasm_lib_url)
            .then((response) => response.arrayBuffer())
            .then((arrayBuffer) => {
              const buffer = Buffer.from(arrayBuffer);
              const zipfile_path = path.join(kdf_zips_dir, zipfile_name);
              fs.writeFileSync(zipfile_path, buffer);

              // Extract version from filename
              const basename = path.basename(zipfile_name, '.zip');
              const temp = basename.split('_').slice(1).join('_');
              const version = temp.split('-')[0];

              // Unzip and process files
              exec(
                `
                cd "${kdf_zips_dir}" &&
                mkdir -p temp &&
                unzip -o "${zipfile_name}" -d temp &&
                cd temp &&
                mv kdflib.js ../../js/kdflib.js &&
                mv kdflib.d.ts ../../js/kdflib.d.ts &&
                rsync -avh --delete snippets/ ../../js/snippets/ &&
                mv kdflib_bg.wasm ../../public/kdflib_bg_${version}.wasm &&
                cd .. &&
                rm -rf temp
              `,
                (error, stdout, stderr) => {
                  if (error) {
                    console.error(`Extraction error: ${error}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(
                      JSON.stringify({
                        status: 'error',
                        message: 'Failed to extract WASM library',
                      }),
                    );
                  } else {
                    // Update .env file
                    const envPath = path.join(__dirname, '.env');
                    let envContent = fs.readFileSync(envPath, 'utf8');
                    envContent = envContent.replace(
                      /VITE_WASM_BIN=.*/,
                      `VITE_WASM_BIN=kdflib_bg_${version}.wasm`,
                    );
                    fs.writeFileSync(envPath, envContent);
                    pm2.connect((err) => {
                      if (err) {
                        console.error('Error connecting to PM2:', err);
                        process.exit(2);
                      }

                      // Restart a specific process by name
                      pm2.restart('web-server', (err) => {
                        if (err) {
                          console.error('[web-server]: Error restarting process:', err);
                        } else {
                          console.log('[web-server]:Process restarted successfully');
                        }
                        pm2.disconnect();
                        puppeteerPage.reload();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(
                          JSON.stringify({
                            status: 'success',
                            action: 'update_wasm_lib',
                            version: version,
                          }),
                        );
                      });
                    });
                  }
                },
              );
            })
            .catch((error) => {
              console.error(`Fetch error: ${error}`);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({ status: 'error', message: 'Failed to download WASM library' }),
              );
            });
        } else {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Action not found/not recognized' }));
        }
      });
    } else if (parsedUrl.pathname === '/rpc') {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        if (connectedClient && connectedClient.readyState === WebSocket.OPEN) {
          const uuid = uuidv4();
          const message = JSON.stringify({ message: body, uuid: uuid });

          connectedClient.send(message);
          connectedClient.on('message', (message) => {
            const receivedMessage = message.toString();
            const receivedMessageObj = JSON.parse(receivedMessage);
            if (receivedMessageObj.uuid === uuid) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              //res.end(JSON.stringify({ status: 'success', message: receivedMessageObj.message }));
              res.end(JSON.stringify(receivedMessageObj.message));
            }
          });
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ status: 'error', message: 'Webpage with KDF lib is not running' }),
          );
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Endpoint not found' }));
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
  }
});

server.listen(PORT, () => {
  console.log(`RPC server started on port ${PORT}, please wait`);
});

(async () => {
  console.log('Starting browser');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  puppeteerPage = await browser.newPage();
  console.log('Chrome Page created');
  const maxRetries = 50;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if the endpoint is active
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${process.env.VITE_WEB_PORT}`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Web server responded with status code ${res.statusCode}`));
          }
        });

        req.on('error', reject);
        req.end();
      });

      // If the check passes, navigate to the page
      await puppeteerPage.goto(`http://127.0.0.1:${process.env.VITE_WEB_PORT}`);
      console.log('KDF Page loaded successfully');
      break; // Exit the loop if successful
    } catch (error) {
      console.error(`Checking web server status: attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        console.error("Max retries reached. Web server didn't start.");
        await browser.close();
        process.exit(1);
      } else {
        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }
})();
