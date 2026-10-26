# Build from the repository root: docker build -f servers/supplier-statement-check/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers/timezone ./servers/timezone
COPY servers/supplier-statement-check ./servers/supplier-statement-check
COPY scripts/bootstrap-timezone.mjs ./scripts/bootstrap-timezone.mjs
RUN npm install --no-audit --no-fund --workspace @theluckystrike/mcp-supplier-statement-check --include-workspace-root=false \
 && node scripts/bootstrap-timezone.mjs \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-supplier-statement-check
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/servers/supplier-statement-check/package.json ./servers/supplier-statement-check/package.json
COPY --from=build /app/servers/supplier-statement-check/dist ./servers/supplier-statement-check/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-supplier-statement-check --include-workspace-root=false
CMD ["node", "servers/supplier-statement-check/dist/index.js"]
