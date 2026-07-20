# Deploy do D1 Custódia em `d1logistica.com.br/custodia`

Este guia mostra como servir o app publicado no Emergent sob o subpath `/custodia`
do seu domínio, usando **Nginx como proxy reverso**.

---

## Pré-requisitos

1. **Deploy do app no Emergent** feito (botão "Deploy" no chat).
   Após o deploy, você terá uma URL de produção, algo como:
   `https://d1-custodia.emergent.host` *(ou o domínio que o painel gerar)*.

   > O ambiente **preview** (`*.preview.emergentagent.com`) **não deve** ser usado em produção.

2. Um servidor Linux (VPS, EC2, etc.) com Nginx instalado onde `d1logistica.com.br` já aponta (DNS A record).

3. Certificado SSL para `d1logistica.com.br` (recomendado: **Let's Encrypt** via `certbot`).

---

## Abordagem Recomendada — Nginx reescreve o path

O Nginx **remove o prefixo `/custodia`** antes de repassar ao Emergent.
Vantagem: **zero mudança no código do app**. O Emergent continua respondendo em `/` e `/api`.

### 1) Arquivo `/etc/nginx/sites-available/d1logistica.com.br`

```nginx
# HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name d1logistica.com.br www.d1logistica.com.br;
    return 301 https://d1logistica.com.br$request_uri;
}

# HTTPS principal
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name d1logistica.com.br www.d1logistica.com.br;

    # Certificados (ajuste os caminhos conforme certbot)
    ssl_certificate     /etc/letsencrypt/live/d1logistica.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/d1logistica.com.br/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Tamanho máximo p/ upload de fotos das custódias
    client_max_body_size 25M;

    # ------------------------------------------------------------
    # Rota principal do app: /custodia/  →  https://<APP_EMERGENT>/
    # ------------------------------------------------------------
    location /custodia/ {
        # ⚠️ Substitua pelo seu domínio de PRODUÇÃO do Emergent
        proxy_pass https://d1-custodia.emergent.host/;

        proxy_http_version 1.1;
        proxy_set_header Host              d1-custodia.emergent.host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        # Cookies (JWT) — reescreve o Path para casar com o subpath
        proxy_cookie_path / /custodia/;

        # Se o backend fizer redirects absolutos
        proxy_redirect https://d1-custodia.emergent.host/ /custodia/;

        # Timeouts confortáveis (uploads de foto)
        proxy_connect_timeout 60s;
        proxy_send_timeout    120s;
        proxy_read_timeout    120s;
    }

    # Redireciona /custodia (sem barra) para /custodia/
    location = /custodia {
        return 301 https://$host/custodia/;
    }

    # Landing / raiz do domínio (opcional — coloque seu site principal aqui)
    location / {
        return 404;
    }
}
```

### 2) Habilite o site e recarregue o Nginx

```bash
sudo ln -s /etc/nginx/sites-available/d1logistica.com.br /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3) SSL com Let's Encrypt (se ainda não tem)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d d1logistica.com.br -d www.d1logistica.com.br
```

---

## Como funciona a mágica da barra `/`

A parte crítica é o `proxy_pass` **com barra no final**:

| `location`     | `proxy_pass`                              | Comportamento                          |
|----------------|-------------------------------------------|----------------------------------------|
| `/custodia/`   | `https://d1-custodia.emergent.host/`      | ✅ **remove** `/custodia` antes         |
| `/custodia/`   | `https://d1-custodia.emergent.host`       | ❌ **mantém** `/custodia` (quebra o app)|

> Sempre com barra final em **ambos** os lados.

---

## Testando

```bash
# Retorna a página do app
curl -I https://d1logistica.com.br/custodia/

# Retorna 200 e um JSON (login funcionando via proxy)
curl -X POST https://d1logistica.com.br/custodia/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"123456789"}'
```

---

## Alternativa: Cloudflare Workers / Nginx Ingress / Traefik

A mesma lógica pode ser feita em **qualquer** proxy que suporte reescrita de path:

- **Cloudflare Workers**: `fetch` reescrevendo `pathname.replace('/custodia', '')`
- **Traefik**: middleware `stripPrefix` com `prefixes: ["/custodia"]`
- **Apache**: `ProxyPass /custodia/ https://d1-custodia.emergent.host/`

---

## Notas importantes

- **Cookies JWT**: a diretiva `proxy_cookie_path / /custodia/;` garante que o cookie
  emitido pelo backend fique restrito ao subpath.
- **Object Storage**: as URLs de imagens são absolutas (Emergent), não passam pelo Nginx — funcionam sem ajuste.
- **CORS**: como o browser vê apenas `d1logistica.com.br`, não há problema de CORS
  entre frontend e backend (ambos passam pelo proxy).
- Se algum dia decidir migrar para **subdomínio** (`custodia.d1logistica.com.br`),
  o setup fica ainda mais simples: só um `CNAME` apontando para o domínio Emergent
  e um `proxy_pass` sem reescrita.

---

## Troubleshooting

| Sintoma                            | Causa provável                                     |
|------------------------------------|----------------------------------------------------|
| Tela branca, 404 em assets JS/CSS  | Faltou a barra `/` no fim do `proxy_pass`          |
| Login OK mas /api/auth/me = 401    | `proxy_cookie_path` ausente ou errado              |
| Upload de foto falha (413)         | Aumentar `client_max_body_size`                    |
| Barcode scanner não pede câmera    | Câmera exige **HTTPS válido** (verifique certbot)  |
