FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --include=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/seed.js && node dist/main.js"]
