# ===== Build stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# 依存インストール
COPY package*.json ./
RUN npm ci

# ソースコードコピー
COPY . .

# Next.js をビルド
RUN npm run build

# ===== Runtime stage =====
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 実行に必要なファイルだけコピー
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Cloud Run が使うポート
EXPOSE 8080
ENV PORT=8080

# 本番起動コマンド
CMD ["npm", "run", "start"]
