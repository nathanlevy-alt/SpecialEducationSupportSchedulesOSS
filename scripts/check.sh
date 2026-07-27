#!/usr/bin/env sh
set -eu
npm run check
node tools/inventory.js
