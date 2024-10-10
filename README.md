# RPC interface for wasm version of Komodo DeFi Framework

This project helps create a simple RPC interface for the wasm version of Komodo DeFi Framework. It allows you to send RPC requests to the KDF's wasm lib running in a web browser and get the response

## Usage

1. Clone the repository

```bash
git clone https://github.com/gcharang/komodefi-wasm-rpc.git
```

2. Install nvm, node and yarn

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Restart your terminal after installing nvm
# Or follow instructions at https://github.com/nvm-sh/nvm#install--update-script
nvm install 18
npm install -g yarn
```

3. Install dependencies

```bash
cd komodefi-wasm-rpc
yarn
```

4. Run the RPC and WebSocket server

```bash
node server.cjs
```

- It will start a web socket server at ws://localhost:7777/ (typically don't need to care about this)
- It will start a rpc server at http://localhost:7783/ and listens for POST requests at http://localhost:7783/rpc

A curl request will look like this:

```bash
curl http://localhost:7783/rpc -d '{"userpass": "RPC_UserP@SSW0RD", "method": "version"}'
```

5. Run the server for KDF's wasm lib

```bash
yarn preview
```

- It will create a simple site with the wasm lib running at http://localhost:3000/
- The site has KDF's logs and WebSocket connection status

6. Update coins

Update the coins file by running the following command. It just needs a url that has a coins json in valid format

```bash
./update_coins.sh https://raw.githubusercontent.com/KomodoPlatform/coins/master/coins
```

7. Update the wasm lib

```bash
./update_wasm.sh https://sdk.devbuilds.komodo.earth/dev/kdf_e65fefe-wasm.zip
```

It just needs a url that has a wasm lib in valid format
