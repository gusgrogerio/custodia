# D1 Custódia - PRD (Product Requirements Document)

## Problema Original
Criar uma aplicação web responsiva chamada "D1 Custódia" para operação logística que registra custódias, fotos de remessas, etiquetas e caixas.

## Datas de Implementação
- MVP: 31/03/2026
- Funcionalidades de Caixa e Alertas: 27/04/2026
- Central de Custódias: 27/04/2026
- Tabs por Região + Busca em Tempo Real + Validação Região: 27/04/2026

## Arquitetura

### Backend (FastAPI)
- Autenticação JWT com httpOnly cookies
- MongoDB para persistência
- Object Storage da Emergent para fotos
- Exportação CSV
- Sistema de alertas para custódias sem tratativa
- Ações em massa (bulk update)

### Frontend (React)
- Design responsivo (mobile-first)
- Tema escuro com azul
- Menu lateral desktop / bottom nav mobile
- Shadcn UI components
- QR Code para etiquetas

## User Personas
1. **Operador Logístico**: Registra custódias em campo pelo celular
2. **Supervisor**: Monitora dashboard e Central de Custódias no desktop
3. **Administrador**: Gerencia usuários, exporta dados e executa ações em massa

## What's Been Implemented

### Fase 1 - MVP (31/03/2026)
- [x] Autenticação JWT com bcrypt
- [x] CRUD de custódias
- [x] Upload de fotos (Object Storage)
- [x] Exportação CSV
- [x] Dashboard com cards de métricas
- [x] Menu responsivo
- [x] Admin user seeded (admin / 123456789)

### Fase 2 - Caixas e Alertas (27/04/2026)
- [x] Identificação Automática de Caixas (CX-YYYYMMDD-NNN)
- [x] Campo de Volumes (1/2, 2/3, etc.)
- [x] Sistema de Alertas Visuais (8 dias: amarelo, 10+ dias: vermelho)
- [x] Geração de Etiqueta com QR Code
- [x] Novos Filtros no Dashboard

### Fase 3 - Central de Custódias (27/04/2026)
- [x] **Nova página Central de Custódias**
- [x] **5 Cards de Métricas**: Total, Aguardando, Próx. Devolução, Apta Devolução, Finalizadas
- [x] **Tabela Completa** com colunas:
  - Nº Caixa
  - Código da remessa
  - Cliente
  - Telefone
  - Cidade / Estado
  - Tipo de ocorrência
  - Status
  - Dias sem tratativa
  - Data da última atualização
  - Responsável
  - Botão Ver detalhes
- [x] **Filtros Avançados**:
  - Buscar por código da remessa
  - Buscar por número da caixa
  - Filtrar por status
  - Filtrar por ocorrência
  - Filtrar por responsável
  - Filtrar por período (data início/fim)
  - Ordenar por dias sem tratativa
  - Checkboxes: Próximas da devolução, Aptas para devolução, Sem foto, Sem tratativa
- [x] **Selos Visuais**:
  - "8 dias" / "9 dias" (amarelo)
  - "Pode devolver" (vermelho para 10+ dias)
- [x] **Cores das linhas**:
  - Normal: cinza/azul
  - 8-9 dias: fundo amarelo
  - 10+ dias: fundo vermelho
- [x] **Seleção Múltipla e Ações em Massa**:
  - Marcar como devolvida
  - Exportar selecionados
- [x] **Exportar para CSV/Excel**
- [x] **Versão Mobile com Cards Expansíveis**

### Fase 4 - Tabs Regionais e Busca Avançada (27/04/2026)
- [x] **Tabs de Região na Central** (Todos / São Paulo / Guarulhos) com contadores em tempo real
- [x] **Indicadores visuais por região** (pontos amarelo 8d / vermelho 10d)
- [x] **Barra de busca em tempo real** (código, cliente, telefone, nº caixa)
- [x] **Endpoint GET /api/custodies/region-stats** (totais e atrasos por região)
- [x] **Campo Região OBRIGATÓRIO no cadastro** (validação client-side + server-side 400)
- [x] **Testes automatizados**: `/app/backend/tests/test_region_features.py` (14/14 ✅)

## Status Disponíveis
- `pending` - Em andamento
- `resolved` - Finalizada
- `ready_for_return` - Apta para Devolução
- `returned` - Devolvida

## API Endpoints

### Autenticação
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me
- POST /api/auth/logout
- POST /api/auth/refresh

### Custódias
- GET /api/custodies - Lista custódias (filtros: status, occurrence_type, responsible_id, date_from, date_to, search_code, search_box, near_return, ready_for_return, no_photos, no_treatment, sort_by)
- POST /api/custodies - Cria custódia
- GET /api/custodies/{id} - Detalhes
- PATCH /api/custodies/{id} - Atualiza
- POST /api/custodies/{id}/photos - Upload de foto
- GET /api/custodies/stats - Métricas do Dashboard
- GET /api/custodies/central-stats - Métricas da Central
- GET /api/custodies/alerts - Lista alertas
- GET /api/custodies/{id}/label - Dados para etiqueta
- GET /api/custodies/export/csv - Exporta CSV
- POST /api/custodies/bulk-update - Ações em massa
- GET /api/custodies/region-stats - Métricas por região (SP / Guarulhos)

## Test Credentials
- Admin: admin / 123456789

## Próximas Melhorias (Backlog)
- [ ] **P1**: Ações em massa adicionais na Central ("Atualizar responsável", "Enviar para planilha" — Msg 171)
- [ ] **P2**: Notificações push (Firebase Cloud Messaging) para 8/10 dias sem tratativa (Msg 79)
- [ ] Integração real com Google Sheets
- [ ] Relatórios em PDF
- [ ] Multi-tenant
- [ ] Gestão de usuários
- [ ] Refatorar `/app/backend/server.py` (>1000 linhas) em routers (auth/custodies/storage)
