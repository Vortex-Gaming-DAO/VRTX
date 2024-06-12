#!/bin/sh

echo ">> Building contractV2"

near-sdk-js build src/contractV2.ts build/exchange.wasm

rm -rf buildV2

mv "build" "buildV2"