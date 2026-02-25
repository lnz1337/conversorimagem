# Conversor de Imagens em Massa

Aplicativo web para conversao em lote de imagens. Feito com Next.js + Sharp, pronto para deploy na Vercel.

## Formatos Suportados

| Entrada | Saida |
|---------|-------|
| WebP, AVIF, JPEG, JPG, PNG, JFIF, BMP, TIFF, GIF | WebP, AVIF, JPEG, JPG, PNG, JFIF, BMP, TIFF |

## Funcionalidades

- Arrastar e soltar imagens ou selecionar via dialogo
- Deteccao automatica do formato de cada imagem
- Lista visual com thumbnail, nome, formato e tamanho
- Dropdown para selecao do formato de destino
- Controle de qualidade (10-100%)
- Barra de progresso em tempo real
- Download individual ou ZIP para multiplos arquivos
- Log detalhado de conversoes (sucessos e erros)
- Tema escuro/claro alternavel
- Interface responsiva

## Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Processamento:** Sharp (API Route server-side)
- **Download:** JSZip para empacotamento em ZIP

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Acesse http://localhost:3000.

## Deploy na Vercel

1. Faca push do repositorio para o GitHub
2. Acesse [vercel.com/new](https://vercel.com/new)
3. Importe o repositorio
4. Clique em "Deploy" — nenhuma configuracao adicional necessaria

## Estrutura

```
src/
  app/
    page.tsx          # Interface principal (client component)
    layout.tsx        # Layout com metadata
    globals.css       # Estilos e variaveis de tema
    api/
      convert/
        route.ts      # API Route para conversao de imagens via Sharp
```
