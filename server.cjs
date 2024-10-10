const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const url = require('url');

const wss = new WebSocket.Server({ port: 7777 });
let connectedClient = null;

wss.on("connection", (ws) => {
  console.log("New connection");
  connectedClient = ws;

  // ws.on('message', (message, isBinary) => {
  //   message = isBinary ? message : message.toString();
  //   console.log('Received message:', message);
  //   ws.send(message);
  // });

  ws.on('close', () => {
    console.log('Client disconnected');
    connectedClient = null;
  });
});

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/rpc') {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        if (connectedClient && connectedClient.readyState === WebSocket.OPEN) {
          const uuid = uuidv4();
          const message = JSON.stringify({ message: body, uuid: uuid });

          connectedClient.send(message);
          connectedClient.on('message', (message) => {
            const receivedMessage = message.toString();
            const receivedMessageObj = JSON.parse(receivedMessage)
            if (receivedMessageObj.uuid === uuid) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', message: receivedMessageObj.message }));
            }
          });
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Client is offline' }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
  }
});

const PORT = 7783;
server.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});

console.log('WebSocket server started on port 7777');
