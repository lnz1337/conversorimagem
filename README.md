# Conversor de Imagens em Massa

Aplicativo desktop com interface gráfica moderna para conversão em lote de imagens.

## Formatos Suportados

| Entrada | Saída |
|---------|-------|
| WebP, AVIF, JPEG, JPG, PNG, JFIF, BMP, TIFF, GIF | WebP, AVIF, JPEG, JPG, PNG, JFIF, BMP, TIFF |

## Funcionalidades

- Seleção múltipla de imagens (arrastar e soltar ou seletor de arquivos)
- Detecção automática do formato de cada imagem
- Lista de imagens com nome, formato e tamanho
- Menu dropdown para seleção do formato de destino
- Controle de qualidade (10-100) para formatos com compressão
- Conversão em lote com barra de progresso
- Escolha da pasta de destino
- Log detalhado de conversões (sucessos e erros)
- Tema escuro/claro alternável
- Evita sobrescrever arquivos existentes

## Requisitos

- Python 3.10 ou superior
- Sistema operacional: Windows, macOS ou Linux

## Instalação

1. Clone o repositório:

```bash
git clone https://github.com/lnz1337/conversorimagem.git
cd conversorimagem
```

2. Crie um ambiente virtual (recomendado):

```bash
python -m venv venv
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

3. Instale as dependências:

```bash
pip install -r requirements.txt
```

> **Nota:** O suporte a AVIF requer o pacote `pillow-avif-plugin`. Caso a instalação falhe, o aplicativo funcionará normalmente para todos os outros formatos.

> **Nota:** O suporte a arrastar e soltar requer `tkinterdnd2`. Caso não esteja disponível, a funcionalidade de seleção de arquivos por diálogo continua funcionando.

## Uso

Execute o aplicativo:

```bash
python conversor.py
```

### Passos para converter imagens:

1. **Adicionar imagens** — Clique em "Adicionar Arquivos" ou "Adicionar Pasta", ou arraste imagens para a área indicada
2. **Escolher formato** — Selecione o formato de destino no dropdown
3. **Ajustar qualidade** — Defina a qualidade (aplicável a JPEG, WebP e AVIF)
4. **Selecionar pasta de destino** — Clique no ícone de pasta para escolher onde salvar
5. **Converter** — Clique em "Converter Tudo" e acompanhe o progresso

## Estrutura do Projeto

```
conversorimagem/
├── conversor.py        # Aplicação principal (GUI + motor de conversão)
├── requirements.txt    # Dependências Python
└── README.md           # Este arquivo
```

## Licença

MIT
