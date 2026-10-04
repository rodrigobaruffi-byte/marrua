# Site da Marruá Uniformes

Site estático gerado por um único script Node, sem framework e sem dependências.

```
produtos.json   catálogo (produtos, segmentos, clientes, depoimentos) e dados da empresa
build.js        gera o site em dist/
style.css       todo o CSS
site.js         todo o JavaScript do navegador (menu, filtro, galeria, formulário)
img/            imagens (WebP), logos e o sprite de ícones (icones.svg)
fonts/          fontes Barlow, Barlow Condensed e Yellowtail (licença SIL OFL)
dist/           saída do build: é esta pasta que vai para o servidor (não editar)
```

## Gerar o site

```bash
node build.js
```

Para ver no computador, sirva a pasta `dist/` (os links são absolutos, então abrir o arquivo direto não funciona):

```bash
python -m http.server 4321 --directory dist
```

## Adicionar ou alterar um produto

1. Acrescente um item em `"produtos"` no `produtos.json` (copie um existente).
2. Coloque a foto em `img/<arquivo>.webp`, com cerca de 1000 px de largura. Opcional: uma versão de 600 px chamada `img/<arquivo>-600.webp`, usada nos celulares.
3. Rode `node build.js`.

Campos `material` e `caracteristicas` vazios não aparecem na página. `"destaque": true` coloca o produto na home. O build avisa se um segmento não existir ou se faltar alguma imagem.

## Dados que ainda dependem do cliente

Estão no `produtos.json` e basta trocar o valor e rodar o build:

- `empresa.horario`: vazio por enquanto. Ao preencher (ex.: `"Mo-Fr 08:00-18:00"`), o horário aparece no contato e no JSON-LD.
- `empresa.numeros`: 400+ empresas e 8.000 peças/mês ainda precisam de confirmação.
- `site.formEndpoint`: vazio. Com a URL do Formspree/Web3Forms, o formulário também envia por e-mail.
- `empresa.googleAvaliacoes`: hoje é uma busca no Google Maps. Troque pelo link do perfil.

## Publicar e redirecionamentos 301

- **Netlify ou Cloudflare Pages:** publique a pasta `dist/`. O arquivo `dist/_redirects` já contém os 301 das URLs antigas do WordPress.
- **nginx:** use `redirects-nginx.conf` (gerado na raiz) com `include` dentro do bloco `server { }`, e `error_page 404 /404.html;`.

Depois de publicar, confira os 301:

```bash
curl -sI https://marruauniformes.com.br/2026/08/20/jaleco-oxford/ | grep -i -E "^(HTTP|location)"
```
