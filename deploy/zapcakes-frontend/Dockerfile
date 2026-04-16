FROM node:20-slim AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./

ENV VITE_API_URL=https://api.zapcakes.com/api
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

RUN printf 'server {\n    listen 80;\n    server_name _;\n    root /usr/share/nginx/html;\n    index index.html;\n\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n\n    location = /index.html {\n        add_header Cache-Control "no-cache, no-store, must-revalidate";\n    }\n\n    location /assets/ {\n        add_header Cache-Control "public, max-age=31536000, immutable";\n    }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
