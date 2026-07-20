#!/bin/sh
set -e
npm run prisma:migrate:deploy
exec node dist/main.js
