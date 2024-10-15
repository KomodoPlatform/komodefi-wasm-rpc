FROM node:18

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN apt-get update && apt-get install -y gnupg wget && wget --quiet -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor >/etc/apt/trusted.gpg.d/google-archive.gpg && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >/etc/apt/sources.list.d/google.list && apt-get update && apt-get install -y google-chrome-stable && rm -rf /var/lib/apt/lists/*

WORKDIR /app

#COPY package.json yarn.lock ./
#COPY ./docker_files/entrypoint.sh /entrypoint.sh

#RUN yarn install --frozen-lockfile

RUN yarn global add pm2

#RUN yarn install --frozen-lockfile

#RUN npx puppeteer browsers install chrome

#RUN chmod +x /entrypoint.sh
#ENTRYPOINT ["/entrypoint.sh"]

#COPY . .

EXPOSE 7777 7783 3000

CMD yarn install --frozen-lockfile && pm2-runtime ecosystem.config.cjs
