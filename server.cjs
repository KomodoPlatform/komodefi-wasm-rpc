const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const url = require('url');
const puppeteer = require('puppeteer');
const env = require('dotenv');
const pm2 = require('pm2');
const fs = require('fs');
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
            res.end(JSON.stringify({ status: 'error', message: 'Client is offline' }));
          }
        }
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Action not found/not recognized' }));
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
            if (receivedMessageObj.logObject) {
              console.log(receivedMessageObj.logObject.line);
              fs.appendFileSync('mm2.log', JSON.stringify(receivedMessageObj.logObject.line));
            } else if (receivedMessageObj.uuid === uuid) {
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
