#!/bin/sh

echo ">> Building contractV1"

near-sdk-js build src/contractV1.ts build/exchange.wasm

mv "build" "buildV1"