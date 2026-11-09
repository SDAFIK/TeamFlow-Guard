FROM node:24-bookworm-slim AS build
WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 TEAMFLOW_BACKEND=supabase
COPY --from=build --chown=node:node /build/.next/standalone ./
COPY --from=build --chown=node:node /build/.next/static ./.next/static
COPY --from=build --chown=node:node /build/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
