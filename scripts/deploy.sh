#!/bin/bash
# Deploy script para ZapCakes na VPS mach9.cloud (46.202.146.165)
# Uso: ./scripts/deploy.sh [servico]
# Exemplos:
#   ./scripts/deploy.sh frontend
#   ./scripts/deploy.sh site
#   ./scripts/deploy.sh api
#   ./scripts/deploy.sh all

SSH_KEY="$HOME/.ssh/id_ed25519"
VPS_IP="46.202.146.165"
SSH_CMD="ssh -i $SSH_KEY root@$VPS_IP"

get_container_id() {
  $SSH_CMD "docker ps -q -f name=mach9_zapcakes-$1.1"
}

deploy_frontend() {
  echo "=== Deploying zapcakes-frontend ==="
  CONTAINER=$($SSH_CMD "docker ps -q -f name=mach9_zapcakes-frontend.1")
  $SSH_CMD "docker exec $CONTAINER bash -c 'source /root/.nvm/nvm.sh && cd /code && git pull origin main && cd frontend && npm install && VITE_API_URL=https://api.zapcakes.com/api npm run build'"
  echo "=== Frontend deployed! (app.zapcakes.com) ==="
}

deploy_site() {
  echo "=== Deploying zapcakes-site ==="
  CONTAINER=$($SSH_CMD "docker ps -q -f name=mach9_zapcakes-site.1")
  $SSH_CMD "docker exec $CONTAINER bash -c 'source /root/.nvm/nvm.sh && cd /code && git pull origin main && cd site && npm install && VITE_LOGIN_URL=https://app.zapcakes.com/login VITE_API_URL=https://api.zapcakes.com/api npm run build'"
  echo "=== Site deployed! (www.zapcakes.com) ==="
}

deploy_api() {
  echo "=== Deploying zapcakes-api ==="
  CONTAINER=$($SSH_CMD "docker ps -q -f name=mach9_zapcakes-api.1")
  $SSH_CMD "docker exec $CONTAINER bash -c 'source /root/.nvm/nvm.sh && cd /code && git pull origin main && cd backend && npm install && npx prisma generate && npx prisma db push --skip-generate'"
  echo "=== API deployed! Reiniciando... ==="
  $SSH_CMD "docker exec $CONTAINER bash -c 'source /root/.nvm/nvm.sh && cd /code/backend && supervisorctl restart nodejs-server 2>/dev/null || true'"
  echo "=== API deployed! (mach9-zapcakes-api.wxclq8.easypanel.host) ==="
}

case "${1:-all}" in
  frontend) deploy_frontend ;;
  site)     deploy_site ;;
  api)      deploy_api ;;
  all)
    deploy_api
    deploy_frontend
    deploy_site
    ;;
  *)
    echo "Uso: $0 [frontend|site|api|all]"
    exit 1
    ;;
esac
