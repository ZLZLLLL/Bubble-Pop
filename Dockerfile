FROM node:24-bookworm-slim AS build
WORKDIR /build
COPY index.html style.css assets-theme.css game.js app.js assets.js persistence.js ./
COPY scripts/build-release.cjs ./scripts/build-release.cjs
COPY assets/ ./assets/
RUN node scripts/build-release.cjs

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5188 DATA_DIR=/app/data
WORKDIR /app
COPY --from=build --chown=node:node /build/public/ ./public/
COPY --chown=node:node server.cjs storage.cjs game.js package.json ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 5188
CMD ["node", "server.cjs"]
