FROM node:20-slim AS build

WORKDIR /app

COPY site/package*.json ./
RUN npm install

COPY site/ ./

ENV VITE_API_URL=https://api.zapcakes.com/api
ENV VITE_LOGIN_URL=https://app.zapcakes.com/login
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

RUN printf 'server {\n    listen 80;\n    server_name _;\n    root /usr/share/nginx/html;\n    index index.html;\n\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
