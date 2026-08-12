# D1 Custódia — Deploy independente da Emergent

Esta versão roda com **React + Nginx + FastAPI + MongoDB** em Docker. As fotos ficam em um volume persistente da própria VPS e o frontend acessa a API pelo mesmo domínio (`/api`).

## 1. Pré-requisitos na VPS

- Docker Engine
- Docker Compose v2 (`docker compose`)
- Nginx instalado no host (para o domínio/HTTPS)
- DNS de `custodia.d1logistica.com.br` apontando para o IP da VPS

## 2. Preparar o projeto

```bash
git clone https://github.com/gusgrogerio/custodia.git
cd custodia
cp .env.example .env
```

Edite `.env` e troque todos os valores sensíveis.

Para gerar um JWT forte:

```bash
openssl rand -hex 64
```

Não faça commit do `.env`.

## 3. Subir a aplicação

```bash
docker compose build
docker compose up -d
```

Verifique:

```bash
docker compose ps
docker compose logs -f backend
```

O frontend fica disponível somente em `127.0.0.1:8080` por padrão. Isso é intencional: o acesso público deve passar pelo Nginx/HTTPS do host.

## 4. Nginx do domínio

Crie `/etc/nginx/sites-available/custodia.d1logistica.com.br`:

```nginx
server {
    listen 80;
    server_name custodia.d1logistica.com.br;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative:

```bash
sudo ln -s /etc/nginx/sites-available/custodia.d1logistica.com.br /etc/nginx/sites-enabled/custodia.d1logistica.com.br
sudo nginx -t
sudo systemctl reload nginx
```

Depois instale o certificado HTTPS com Certbot conforme a distribuição da VPS. Após HTTPS estar ativo, confirme que `PUBLIC_URL` no `.env` está como:

```env
PUBLIC_URL=https://custodia.d1logistica.com.br
```

E reinicie o backend:

```bash
docker compose up -d --force-recreate backend
```

## 5. Como as fotos funcionam agora

O backend de produção inicia por `backend/standalone.py`. Ele substitui o Object Storage da Emergent pelas funções de `backend/local_storage.py`.

Os arquivos ficam no volume Docker `custody_uploads`, montado em:

```text
/data/uploads
```

O caminho lógico salvo no MongoDB não muda, portanto o frontend continua usando os mesmos registros `storage_path`.

## 6. Migrar o MongoDB antigo (se houver dados na Emergent)

Antes do corte definitivo, obtenha a antiga `MONGO_URL` do ambiente da Emergent. Não coloque essa URL no GitHub.

Na VPS:

```bash
export LEGACY_MONGO_URL='mongodb://...'
docker run --rm mongo:7 mongodump --uri="$LEGACY_MONGO_URL" --archive --gzip > legacy-mongo.archive.gz
```

Suba somente o Mongo local:

```bash
docker compose up -d mongo
```

Carregue o `.env` e restaure:

```bash
set -a
source .env
set +a
cat legacy-mongo.archive.gz | docker compose exec -T mongo mongorestore \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "${DB_NAME:-d1_custodia}" \
  --archive --gzip --drop
```

Depois suba todo o stack:

```bash
docker compose up -d
```

## 7. Migrar fotos antigas da Emergent

Se já existem fotos gravadas no Object Storage da Emergent, primeiro restaure o MongoDB conforme a etapa anterior. Depois execute o migrador uma única vez.

Forneça a chave somente na sessão do terminal:

```bash
read -s EMERGENT_LLM_KEY
export EMERGENT_LLM_KEY
docker compose exec -T \
  -e EMERGENT_LLM_KEY="$EMERGENT_LLM_KEY" \
  backend python migrate_emergent_photos.py
unset EMERGENT_LLM_KEY
```

O script percorre as fotos cadastradas no MongoDB e copia os arquivos para `/data/uploads`. Ele ignora arquivos que já tenham sido migrados.

Depois de confirmar que todas as fotos estão abrindo no novo domínio, a chave da Emergent não é mais necessária para a aplicação.

## 8. Backup

Dar permissão de execução na primeira vez:

```bash
chmod +x scripts/backup.sh scripts/restore.sh
```

Criar backup:

```bash
./scripts/backup.sh
```

O backup contém:

- MongoDB (`mongodb.archive.gz`)
- fotos (`uploads.tar.gz`)

Os arquivos ficam em `backups/AAAAMMDD-HHMMSS/`.

Para restaurar:

```bash
./scripts/restore.sh backups/AAAAMMDD-HHMMSS
```

## 9. Atualizações futuras

Após atualizar o código:

```bash
git pull
docker compose build
docker compose up -d
```

Antes de uma atualização importante, rode `./scripts/backup.sh`.

## 10. Segurança

- Não versionar `.env`, `credentials.json`, chaves privadas ou Service Account JSON.
- Usar senha forte no MongoDB e no administrador.
- Manter a porta do MongoDB sem exposição pública.
- Manter o frontend Docker ligado apenas a `127.0.0.1` e publicar via Nginx/HTTPS.
- Criar usuários somente pelo administrador do D1 Custódia; o cadastro público já permanece bloqueado.
- Para produção, o repositório deve preferencialmente ser privado.
