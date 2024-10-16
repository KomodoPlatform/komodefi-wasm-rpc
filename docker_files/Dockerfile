FROM node:18

# changes gid, uid of default node user
RUN groupmod -g 1001 node && usermod -u 1001 -g 1001 node

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN apt-get update && apt-get install -y gnupg wget rsync unzip && wget --quiet -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor >/etc/apt/trusted.gpg.d/google-archive.gpg && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >/etc/apt/sources.list.d/google.list && apt-get update && apt-get install -y google-chrome-stable && rm -rf /var/lib/apt/lists/*

# Setup up user and working directory
ARG GROUP_ID
ARG USER_ID
ARG SERVICE_CLI
RUN addgroup --gid ${GROUP_ID} kdfgroup
RUN adduser --disabled-password --gecos '' --uid ${USER_ID} --gid ${GROUP_ID} kdfuser

RUN yarn global add pm2

WORKDIR /home/kdfuser/app

RUN PATH=/usr/local/bin/:$PATH

RUN chown -R kdfuser:kdfgroup /home/kdfuser/app
USER kdfuser

CMD yarn install --frozen-lockfile && pm2-runtime ecosystem.config.cjs
