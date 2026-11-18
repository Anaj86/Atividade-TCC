# Imagem do Conect60+ (site + API). Usada pelo docker-compose e por hospedagens como Railway e Render.
FROM node:22-slim

# O Prisma precisa do OpenSSL para falar com o MySQL
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Dependências primeiro (aproveita o cache do Docker). O schema entra antes porque o "postinstall" roda "prisma generate".
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
RUN mkdir -p /app/uploads

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Ao iniciar: atualiza as tabelas, cria os dados iniciais (se ainda não existirem) e sobe o servidor
CMD ["npm", "run", "deploy"]
