# RPC interface for wasm version of Komodo DeFi Framework

This project helps create a simple RPC interface for the wasm version of Komodo DeFi Framework. It allows you to send RPC requests to the KDF's wasm lib running in a web browser and get the response

## Setup

1. Clone the repository

```bash
git clone https://github.com/KomodoPlatform/komodefi-wasm-rpc
```

2. Install nvm, node and yarn

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Restart your terminal after installing nvm
# Or follow instructions at https://github.com/nvm-sh/nvm#install--update-script
nvm install 18
npm install -g yarn
```

3. Install dependencies, set environment variables and update MM2.json

```bash
cd komodefi-wasm-rpc
yarn install --frozen-lockfile
cp .env.example .env
```

- Change the port values in the .env file if necessary. The VITE_WASM_BIN value will be set automatically when updating the wasm lib using the `update_wasm.sh` script
- Update the MM2.json file with the appropriate values

## Usage with docker

Run the following command to start the docker container

```bash
docker compose up
```

- It will start a web socket server at ws://localhost:7777/ (typically don't need to care about this)
- It will start a rpc server at http://localhost:7783/ and listens for POST requests at http://localhost:7783/rpc

If you update the kdf wasm lib, restart the docker container for the changes to take effect:

```bash
docker compose down && docker compose up
```

## Usage without docker

1) Run the RPC and WebSocket server

```bash
node server.cjs
```

- It will start a web socket server at ws://localhost:7777/ (typically don't need to care about this)
- It will start a rpc server at http://localhost:7783/ and listens for POST requests at http://localhost:7783/rpc

2. Run the server for KDF's wasm lib

```bash
yarn preview
```

- It will create a simple site with the wasm lib running at http://localhost:3000/
- The site will connect to the WebSocket server running at ws://localhost:7777/ and wait for RPC requests

3) Visit the site at http://localhost:3000/

## Sending a request

A curl request will look like this:

```bash
curl http://localhost:7783/rpc -d '{"userpass": "RPC_UserP@SSW0RD", "method": "version"}'
```

## Update coins file

Update the coins file by running the following command. It just needs a url that has a coins json in valid format

```bash
./update_coins.sh https://raw.githubusercontent.com/KomodoPlatform/coins/master/coins
```

If you have a coins array in MM2.json, the kdf wasm lib will use that instead of using the coins file downloaded from this script

## Update the wasm lib

```bash
./update_wasm.sh https://sdk.devbuilds.komodo.earth/dev/kdf_e65fefe-wasm.zip
```

It just needs a url that has a wasm lib in valid format

## Misc features

### Restart the KDF lib

Use the `restart_kdf` action to reload the page running the wasm lib

```bash
curl http://localhost:7783/admin -d '{
  "action": "restart_kdf"
}'
```

Send the `mm2_conf` param in addition to use a custom MM2 configuration

```bash
curl http://localhost:7783/admin -d '{
  "action": "restart_kdf",
  "mm2_conf": {
    "gui": "MM2_WASM_RPC_TESTER",
    "mm2": 1,
    "passphrase": "wasmtest",
    "allow_weak_password": true,
    "rpc_password": "RPC_UserP@SSW0RD",
    "netid": 8762
  }
}'
```
