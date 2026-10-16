# Build from the repository root: docker build -f servers/three-way-match/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers/timezone ./servers/timezone
COPY servers/three-way-match ./servers/three-way-match
COPY scripts/bootstrap-timezone.mjs ./scripts/bootstrap-timezone.mjs
RUN npm install --no-audit --no-fund --workspace @theluckystrike/mcp-three-way-match --include-workspace-root=false \
 && node scripts/bootstrap-timezone.mjs \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-three-way-match
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/servers/three-way-match/package.json ./servers/three-way-match/package.json
COPY --from=build /app/servers/three-way-match/dist ./servers/three-way-match/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-three-way-match --include-workspace-root=false
CMD ["node", "servers/three-way-match/dist/index.js"]
