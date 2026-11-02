#!/usr/bin/env bash
# Azure App Service startup: prepare the database, seed the provided
# dataset (idempotent), then start the API.
set -e
mkdir -p /home/bookleaf
cd /home/site/wwwroot
npx prisma db push --skip-generate
npx prisma generate
node dist/prisma/seed.js
node dist/src/index.js
