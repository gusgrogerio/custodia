# D1 Custódia - PRD (Product Requirements Document)

## Problema Original
Criar uma aplicação web responsiva chamada "D1 Custódia" para operação logística que registra custódias, fotos de remessas, etiquetas e caixas.

## Datas de Implementação
- MVP: 31/03/2026
- Funcionalidades de Caixa e Alertas: 27/04/2026

## Arquitetura

### Backend (FastAPI)
- Autenticação JWT com httpOnly cookies
- MongoDB para persistência
- Object Storage da Emergent para fotos
- Exportação CSV
- Sistema de alertas para custódias sem tratativa

### Frontend (React)
- Design responsivo (mobile-first)
- Tema escuro com azul
- Menu lateral desktop / bottom nav mobile
- Shadcn UI components
- QR Code para etiquetas

## User Personas
1. **Operador Logístico**: Registra custódias em campo pelo celular
2. **Supervisor**: Monitora dashboard no desktop
3. **Administrador**: Gerencia usuários e exporta dados

## Core Requirements (Static)
- [x] Login com autenticação JWT
- [x] Dashboard com métricas (total, pendentes, resolvidos, vencidos, perto devolução, apta devolução)
- [x] Tabela de remessas com status
- [x] Nova Custódia com upload de fotos
- [x] Detalhes da custódia com histórico
- [x] Filtros no histórico
- [x] Exportação CSV
- [x] Design responsivo

## What's Been Implemented

### Fase 1 - MVP (31/03/2026)
- [x] Backend completo com FastAPI
- [x] Autenticação JWT com bcrypt
- [x] CRUD de custódias
- [x] Upload de fotos (Object Storage)
- [x] Exportação CSV
- [x] Frontend React com Shadcn UI
- [x] Dashboard com cards de métricas
- [x] Formulário Nova Custódia
- [x] Página de detalhes
- [x] Histórico com filtros
- [x] Menu responsivo
- [x] Admin user seeded (admin / 123456789)

### Fase 2 - Caixas e Alertas (27/04/2026)
- [x] **Identificação Automática de Caixas**
  - Número único formato CX-YYYYMMDD-NNN
  - Geração automática ao criar custódia
  - Exibido em todas as telas (dashboard, detalhes, histórico, exportação)
- [x] **Campo de Volumes**
  - volume_current e volume_total (ex: 1/2, 2/3)
  - Exibido na tabela e nos detalhes
- [x] **Sistema de Alertas Visuais**
  - Contador de dias sem tratativa
  - Alerta preventivo (8 dias): badge amarelo
  - Alerta de devolução (10+ dias): badge vermelho
  - Atualização automática de status para "Apta para Devolução"
  - Registro automático no histórico
- [x] **Geração de Etiqueta**
  - Botão "Gerar Etiqueta" na página de detalhes
  - Etiqueta com: Nº Caixa, Volume, Código, Cliente, Data
  - QR Code com número da caixa
  - Impressão direta
- [x] **Novos Filtros no Dashboard**
  - "Perto Devolução" (8-9 dias)
  - "Apta Devolução" (10+ dias)
  - Cards clicáveis para filtrar tabela
- [x] **CSV Atualizado**
  - Novas colunas: Nº Caixa, Volume, Dias sem Tratativa

## Prioritized Backlog

### P0 (Critical) - DONE
- Login/Logout
- Dashboard
- Nova Custódia
- Upload de fotos
- Identificação de caixas
- Sistema de alertas

### P1 (High Priority) - Future
- Integração real com Google Sheets (requer credenciais)
- Notificações push (requer Firebase)
- Relatórios avançados em PDF

### P2 (Medium Priority) - Future
- Multi-tenant
- Gestão de usuários
- Auditoria completa
- Temas personalizáveis

## Test Credentials
- Admin: admin / 123456789

## API Endpoints

### Autenticação
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me
- POST /api/auth/logout
- POST /api/auth/refresh

### Custódias
- GET /api/custodies - Lista custódias (com filtros: status, occurrence_type, near_return, ready_for_return)
- POST /api/custodies - Cria custódia (retorna box_number automático)
- GET /api/custodies/{id} - Detalhes (inclui days_without_treatment)
- PATCH /api/custodies/{id} - Atualiza (status, observation)
- POST /api/custodies/{id}/photos - Upload de foto
- GET /api/custodies/stats - Métricas (inclui near_return, ready_for_return)
- GET /api/custodies/alerts - Lista alertas ativos
- GET /api/custodies/{id}/label - Dados para etiqueta
- GET /api/custodies/export/csv - Exporta CSV

### Outros
- GET /api/users - Lista usuários
- GET /api/files/{path} - Download de arquivo

## Formato do Número da Caixa
```
CX-YYYYMMDD-NNN
Exemplo: CX-20260427-001
```

## Status Disponíveis
- `pending` - Pendente
- `resolved` - Resolvido
- `ready_for_return` - Apta para Devolução

## Tipos de Ocorrência
- desconhecido_no_local
- numero_nao_localizado
- endereco_nao_localizado
- mudou_se
- cliente_ausente
- recusado
- entrega_reagendada
- outro
