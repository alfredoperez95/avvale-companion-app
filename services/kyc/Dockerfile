FROM node:20-alpine

# git is required by some claude CLI tools (Bash/Grep/etc.)
RUN apk add --no-cache git bash ca-certificates

WORKDIR /app

# Install the Claude Code CLI globally so `claude` binary is on PATH.
# Users bring their own ANTHROPIC_API_KEY at request time.
RUN npm install -g @anthropic-ai/claude-code@latest

# Install app deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Copy app sources
COPY server/ ./server/
COPY public/ ./public/

# Writable dir for per-chat-session workdirs
RUN mkdir -p /app/kyc-sessions && chown -R node:node /app/kyc-sessions

EXPOSE 3388

USER node

CMD ["node", "server/server.js"]
