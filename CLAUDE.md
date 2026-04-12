# Financas Familiares

## Arquitetura

App de financas familiar (single-page HTML + Vercel edge functions).
Frontend: `index.html` (monolito HTML/CSS/JS).
Proxy API: `api/proxy.js` (Vercel serverless, faz bridge para APIs externas).

## Backends de dados bancarios

O app suporta (ou vai suportar) dois backends para dados bancarios:

### Organizze (atual)
- API: `https://api.organizze.com.br/rest/v2/`
- Auth: Basic Auth (email + token)
- Proxy: `/api/proxy.js`
- Status: funcional, mas com problemas de WAF/rate-limit

### Pluggy (em implementacao)
- Site: pluggy.ai / meu.pluggy.ai
- O usuario esta criando conta no Pluggy
- Plano: implementar chave comutadora no app (Organizze vs Pluggy)
- Estrategia: manter ambos em paralelo; remover o que nao funcionar bem
- A integracao Pluggy deve espelhar a mesma interface de dados (accounts, categories, transactions)

## Decisoes de design

- Manter ambos backends (Organizze + Pluggy) ate validar qual funciona melhor
- UI: switch/toggle nas Configuracoes para escolher o backend ativo
- Normalizacao: camada de adaptadores que converte a resposta de cada API para o formato interno do app
- Prioridade: nao quebrar o fluxo existente do Organizze enquanto Pluggy e integrado
