# D1 Custódia - PRD (Product Requirements Document)

## Problema Original
Criar uma aplicação web responsiva chamada "D1 Custódia" para operação logística que registra custódias, fotos de remessas, etiquetas e caixas.

## Data de Implementação
31/03/2026

## Arquitetura

### Backend (FastAPI)
- Autenticação JWT com httpOnly cookies
- MongoDB para persistência
- Object Storage da Emergent para fotos
- Exportação CSV

### Frontend (React)
- Design responsivo (mobile-first)
- Tema escuro com azul
- Menu lateral desktop / bottom nav mobile
- Shadcn UI components

## User Personas
1. **Operador Logístico**: Registra custódias em campo pelo celular
2. **Supervisor**: Monitora dashboard no desktop
3. **Administrador**: Gerencia usuários e exporta dados

## Core Requirements (Static)
- [x] Login com autenticação JWT
- [x] Dashboard com métricas (total, pendentes, resolvidos, vencidos)
- [x] Tabela de remessas com status
- [x] Nova Custódia com upload de fotos
- [x] Detalhes da custódia com histórico
- [x] Filtros no histórico
- [x] Exportação CSV
- [x] Design responsivo

## What's Been Implemented
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

## Prioritized Backlog

### P0 (Critical) - DONE
- Login/Logout
- Dashboard
- Nova Custódia
- Upload de fotos

### P1 (High Priority) - Future
- Integração real com Google Sheets
- Notificações push
- Relatórios avançados

### P2 (Medium Priority) - Future
- Multi-tenant
- Gestão de usuários
- Auditoria completa

## Test Credentials
- Admin: admin / 123456789

## API Endpoints
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me
- POST /api/auth/logout
- GET /api/custodies
- POST /api/custodies
- GET /api/custodies/{id}
- PATCH /api/custodies/{id}
- POST /api/custodies/{id}/photos
- GET /api/custodies/stats
- GET /api/custodies/export/csv
- GET /api/users
