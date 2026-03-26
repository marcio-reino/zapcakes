Email: admin@zapcakes.com
Senha: admin123

API keys OpenAi - ZapCakes
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

evolution api key
429683C4C977415CAAFCCE10F7D57E117D4796

marcio-reino@hotmail.com
marcioreino@gmail.com
123456

Email: superadmin@zapcakes.com
Senha: Super@2026Wp9635sDf74

contato@zapcakes.com
2026#Wp9635sDf74Tfmail

app@zapcakes.com
Wcp89Dfgr834Etuyp96@drg
smtp.hostinger.com - 465
realizado o cadastro em https://resend.com/ mas nao utilizado

1 - 

Email: sistemazapcakes@gmail.com
Instagram: sistemazapcakes
Zc200326



Projeto: mach9
zapcakes-api	Node.js (box)	mach9-zapcakes-app.wxclq8.easypanel.host
zapcakes-frontend	Node.js (box)	app.zapcakes.com
zapcakes-site	Node.js (box)	www.zapcakes.com
zapcakes-mysql	MySQL 9	(interno, porta 1)

Deploy zapcakes-frontend
#############################
ssh -i ~/.ssh/id_ed25519 root@46.202.146.165 "docker exec $(ssh -i ~/.ssh/id_ed25519 root@46.202.146.165 'docker ps -q -f name=mach9_zapcakes-frontend.1') bash -c 'source /root/.nvm/nvm.sh && cd /code && git pull origin main && cd frontend && npm install && VITE_API_URL=https://mach9-zapcakes-api.wxclq8.easypanel.host/api npm run build'"


