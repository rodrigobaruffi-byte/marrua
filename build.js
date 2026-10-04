// Gera o site estático da Marruá em dist/ a partir de produtos.json.
// Uso: node build.js
//
// Para adicionar um produto: acrescente um item em "produtos" no produtos.json,
// coloque a foto em img/<arquivo>.webp (e, se quiser, img/<arquivo>-600.webp
// para celulares) e rode o build de novo.

const fs = require('fs');
const path = require('path');

const dados = JSON.parse(fs.readFileSync(path.join(__dirname, 'produtos.json'), 'utf8'));
const { site, empresa, segmentos, produtos, clientes, depoimentos } = dados;

const DIST = path.join(__dirname, 'dist');
const VERSAO = Date.now().toString(36); // evita cache velho de CSS/JS depois de publicar
const HOJE = new Date().toISOString().slice(0, 10);

const segmentoPorSlug = Object.fromEntries(segmentos.map((s) => [s.slug, s]));
const produtoPorSlug = Object.fromEntries(produtos.map((p) => [p.slug, p]));

const MSG_GERAL = 'Olá, Marruá! Vim pelo site e gostaria de um orçamento de uniformes para minha empresa.';
const msgProduto = (p) => `Olá, Marruá! Vim pelo site e gostaria de um orçamento de ${p.nome}.`;
const msgSegmento = (s) => `Olá, Marruá! Vim pelo site e gostaria de um orçamento de uniformes. Segmento: ${s.nome}.`;

// ---------------------------------------------------------------------------
// Utilidades

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function icone(nome, classe = '') {
  return `<svg class="ic${classe ? ' ' + classe : ''}" aria-hidden="true"><use href="/img/icones.svg#${nome}"></use></svg>`;
}

function linkWhats(mensagem) {
  return `https://wa.me/${empresa.whatsappNumero}?text=${encodeURIComponent(mensagem)}`;
}

function numeroFormatado(n) {
  return n.toLocaleString('pt-BR');
}

// Lê largura e altura direto do cabeçalho do arquivo WebP, para preencher width/height.
const tamanhos = {};
function tamanhoImagem(arquivo) {
  if (tamanhos[arquivo]) return tamanhos[arquivo];
  const caminho = path.join(__dirname, 'img', arquivo);
  if (!fs.existsSync(caminho)) throw new Error(`Imagem não encontrada: img/${arquivo}`);
  const b = fs.readFileSync(caminho);
  const tipo = b.toString('ascii', 12, 16);
  let t;
  if (tipo === 'VP8 ') t = { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  else if (tipo === 'VP8L') {
    const n = b.readUInt32LE(21);
    t = { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
  } else if (tipo === 'VP8X') t = { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  else throw new Error(`img/${arquivo} não é um WebP válido`);
  return (tamanhos[arquivo] = t);
}

// <img> com width/height, lazy loading e versão de 600px quando existir.
function foto(arquivo, alt, { sizes = '(min-width: 1100px) 30vw, (min-width: 640px) 45vw, 85vw', prioridade = false, classe = '' } = {}) {
  const { w, h } = tamanhoImagem(arquivo + '.webp');
  const pequena = `${arquivo}-600.webp`;
  const srcset = fs.existsSync(path.join(__dirname, 'img', pequena))
    ? ` srcset="/img/${pequena} 600w, /img/${arquivo}.webp ${w}w" sizes="${sizes}"`
    : '';
  const carga = prioridade ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<img src="/img/${arquivo}.webp"${srcset} width="${w}" height="${h}" alt="${esc(alt)}" ${carga} decoding="async"${classe ? ` class="${classe}"` : ''}>`;
}

function escrever(rota, html) {
  const arquivo = rota.endsWith('.html') ? path.join(DIST, rota) : path.join(DIST, rota, 'index.html');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, html);
}

function validarDados() {
  for (const p of produtos) {
    for (const s of p.segmentos) {
      if (!segmentoPorSlug[s]) throw new Error(`Produto "${p.slug}" usa o segmento "${s}", que não existe.`);
    }
    for (const im of p.imagens) tamanhoImagem(im.arquivo + '.webp');
  }
  for (const s of segmentos) tamanhoImagem(s.imagem + '.webp');
}

// ---------------------------------------------------------------------------
// Dados estruturados (JSON-LD)

const endereco = empresa.endereco;
const enderecoCompleto = `${endereco.rua}, ${endereco.bairro}, ${endereco.cidade}/${endereco.uf}, CEP ${endereco.cep}`;
const linkMapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${endereco.rua}, ${endereco.bairro}, ${endereco.cidade} - ${endereco.uf}, ${endereco.cep}`)}`;

const negocioLocal = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${site.url}/#empresa`,
  name: site.nome,
  url: `${site.url}/`,
  logo: `${site.url}/img/logo.webp`,
  image: `${site.url}/img/og.jpg`,
  description: 'Fábrica de uniformes profissionais em Curitiba desde 1990.',
  telephone: `+55 ${empresa.telefone}`,
  email: empresa.email,
  foundingDate: empresa.fundacao,
  founder: empresa.fundadores.map((nome) => ({ '@type': 'Person', name: nome })),
  address: {
    '@type': 'PostalAddress',
    streetAddress: endereco.rua,
    addressLocality: endereco.cidade,
    addressRegion: endereco.uf,
    postalCode: endereco.cep,
    addressCountry: 'BR',
  },
  areaServed: 'BR',
  sameAs: [empresa.instagram, empresa.facebook],
  ...(empresa.horario ? { openingHours: empresa.horario } : {}),
};

function migalhas(itens) {
  // itens: [{ nome, rota }], o último é a página atual
  const html = `<nav class="migalhas" aria-label="Você está em"><ol>${itens
    .map((it, i) =>
      i === itens.length - 1
        ? `<li><span aria-current="page">${esc(it.nome)}</span></li>`
        : `<li><a href="${it.rota}">${esc(it.nome)}</a></li>`
    )
    .join('')}</ol></nav>`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nome, item: site.url + it.rota })),
  };
  return { html, jsonld };
}

// ---------------------------------------------------------------------------
// Layout comum

function cabecalho(rota) {
  const ativo = (prefixo) => (rota.startsWith(prefixo) ? ' aria-current="page"' : '');
  return `<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
  <div class="container topo-barra">
    <a class="marca" href="/"><img src="/img/logo.webp" width="440" height="246" alt="Marruá Uniformes Profissionais, página inicial"></a>
    <button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu" data-menu-botao>
      ${icone('list', 'menu-abrir')}${icone('x', 'menu-fechar')}<span class="sr">Menu</span>
    </button>
    <nav class="menu" id="menu" aria-label="Principal">
      <ul class="menu-lista">
        <li><a href="/produtos/"${ativo('/produtos/')}>Produtos</a></li>
        <li class="menu-sub">
          <button type="button" class="menu-sub-botao" aria-expanded="false" aria-controls="sub-segmentos" data-sub-botao>Segmentos ${icone('caret-down')}</button>
          <ul class="sub" id="sub-segmentos">
            ${segmentos.map((s) => `<li><a href="/segmentos/${s.slug}/"${ativo(`/segmentos/${s.slug}/`)}>${icone(s.icone)}${esc(s.nome)}</a></li>`).join('\n            ')}
          </ul>
        </li>
        <li><a href="/quem-somos/"${ativo('/quem-somos/')}>Quem somos</a></li>
        <li><a href="/contato/"${ativo('/contato/')}>Contato</a></li>
      </ul>
      <a class="btn btn-ouro menu-cta" href="/orcamento/">Pedir orçamento</a>
    </nav>
  </div>
</header>`;
}

function rodape() {
  return `<footer class="rodape">
  <div class="container rodape-grade">
    <div class="rodape-marca">
      <img src="/img/logo-claro.webp" width="440" height="246" alt="Marruá Uniformes Profissionais" loading="lazy">
      <p>Há mais de 30 anos fabricando uniformes profissionais com qualidade, durabilidade e atendimento personalizado.</p>
      <div class="redes">
        <a href="${empresa.instagram}" target="_blank" rel="noopener" aria-label="Instagram da Marruá">${icone('instagram-logo')}</a>
        <a href="${empresa.facebook}" target="_blank" rel="noopener" aria-label="Facebook da Marruá">${icone('facebook-logo')}</a>
      </div>
    </div>
    <div>
      <h2 class="rodape-titulo">Produtos</h2>
      <ul>
        <li><a href="/produtos/">Todos os produtos</a></li>
        ${segmentos.map((s) => `<li><a href="/segmentos/${s.slug}/">${esc(s.nome)}</a></li>`).join('\n        ')}
      </ul>
    </div>
    <div>
      <h2 class="rodape-titulo">Empresa</h2>
      <ul>
        <li><a href="/quem-somos/">Quem somos</a></li>
        <li><a href="/orcamento/">Pedir orçamento</a></li>
        <li><a href="/contato/">Contato</a></li>
        <li><a href="/politica-de-privacidade/">Política de Privacidade</a></li>
      </ul>
    </div>
    <div>
      <h2 class="rodape-titulo">Contato</h2>
      <ul class="rodape-contato">
        <li><a href="tel:${empresa.telefoneLink}">${icone('phone')}${empresa.telefone}</a></li>
        <li><a href="${linkWhats(MSG_GERAL)}" target="_blank" rel="noopener">${icone('whatsapp-logo')}${empresa.whatsapp}</a></li>
        <li><a href="mailto:${empresa.email}">${icone('envelope-simple')}${empresa.email}</a></li>
        <li><a href="${linkMapa}" target="_blank" rel="noopener">${icone('map-pin')}<span>${esc(endereco.rua)}<br>${esc(endereco.bairro)}, ${esc(endereco.cidade)}/${endereco.uf}</span></a></li>
      </ul>
    </div>
  </div>
  <div class="container rodape-base">
    <p>© ${new Date().getFullYear()} ${esc(site.nome)}</p>
  </div>
</footer>`;
}

function pagina({ rota, titulo, descricao, conteudo, jsonld = [], indexar = true, mensagemWhats = MSG_GERAL }) {
  const url = site.url + rota;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${url}">
${indexar ? '' : '<meta name="robots" content="noindex">\n'}<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${esc(site.nome)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site.url}/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#14213d">
<link rel="icon" href="/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="preload" href="/fonts/barlow-condensed-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/barlow-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css?v=${VERSAO}">
<script>document.documentElement.classList.add('js')</script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
${cabecalho(rota)}
<main id="conteudo">
${conteudo}
</main>
${rodape()}
<a class="whats-flutuante" href="${linkWhats(mensagemWhats)}" target="_blank" rel="noopener" aria-label="Conversar com a Marruá no WhatsApp">${icone('whatsapp-logo')}</a>
<script src="/site.js?v=${VERSAO}" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Blocos reutilizados

function cardProduto(p) {
  const im = p.imagens[0];
  const nomesSegmentos = p.segmentos.map((s) => segmentoPorSlug[s].nome).join(', ');
  return `<article class="card" data-segmentos="${p.segmentos.join(' ')}">
  <a class="card-foto" href="/produtos/${p.slug}/" tabindex="-1" aria-hidden="true">${foto(im.arquivo, im.alt)}</a>
  <div class="card-corpo">
    <h3 class="card-nome"><a href="/produtos/${p.slug}/">${esc(p.nome)}</a></h3>
    <p class="card-segmentos">${esc(nomesSegmentos)}</p>
    <div class="card-acoes">
      <a class="card-link" href="/produtos/${p.slug}/">Ver detalhes ${icone('arrow-right')}<span class="sr"> de ${esc(p.nome)}</span></a>
      <a class="btn-icone" href="${linkWhats(msgProduto(p))}" target="_blank" rel="noopener" aria-label="Pedir orçamento de ${esc(p.nome)} pelo WhatsApp">${icone('whatsapp-logo')}</a>
    </div>
  </div>
</article>`;
}

function blocoNumeros() {
  return `<dl class="numeros">
  ${empresa.numeros
    .map(
      (n) => `<div class="numero">
    <dt>${esc(n.rotulo)}</dt>
    <dd><span data-contador="${n.valor}">${numeroFormatado(n.valor)}</span>${n.sufixo}</dd>
  </div>`
    )
    .join('\n  ')}
</dl>`;
}

function blocoClientes() {
  return `<ul class="clientes">
  ${clientes
    .map((c) => {
      const { w, h } = tamanhoImagem(c.arquivo + '.webp');
      const quadrado = w / h < 1.6 ? ' class="logo-quadrado"' : '';
      return `<li><img src="/img/${c.arquivo}.webp" width="${w}" height="${h}" alt="${esc(c.nome)}"${quadrado} loading="lazy" decoding="async"></li>`;
    })
    .join('\n  ')}
</ul>`;
}

function blocoCondicoes() {
  return `<ul class="condicoes">
  <li>${icone('package')}<span><strong>Pedido mínimo</strong> ${empresa.pedidoMinimo} peças</span></li>
  <li>${icone('needle')}<span><strong>Produção</strong> sob demanda</span></li>
  <li>${icone('calendar-check')}<span><strong>Prazo médio</strong> ${empresa.prazo}</span></li>
  <li>${icone('seal-check')}<span><strong>Personalização</strong> com a sua marca</span></li>
</ul>`;
}

function ctaFinal({ titulo = 'Pronto para vestir sua equipe com a cara da sua empresa?', mensagem = MSG_GERAL } = {}) {
  return `<section class="cta-final">
  <div class="container cta-grade">
    <div class="cta-texto">
      <h2 class="titulo">${esc(titulo)}</h2>
      <p>Peça seu orçamento sem compromisso. A gente responde rapidinho.</p>
      <div class="acoes">
        <a class="btn btn-marinho" href="${linkWhats(mensagem)}" target="_blank" rel="noopener">${icone('whatsapp-logo')}Pedir orçamento pelo WhatsApp</a>
        <a class="btn btn-contorno" href="tel:${empresa.telefoneLink}">${icone('phone')}Ligar ${empresa.telefone}</a>
      </div>
    </div>
    <img class="cta-mascote" src="/img/mascote.webp" width="508" height="845" alt="Mascote da Marruá, uma onça de boné e camisa polo fazendo sinal de positivo" loading="lazy" decoding="async">
  </div>
</section>`;
}

function topoPagina({ itens, titulo, intro = '', extra = '' }) {
  const m = migalhas(itens);
  return {
    jsonld: m.jsonld,
    html: `<section class="pagina-topo">
  <div class="container">
    ${m.html}
    <h1 class="titulo-pagina">${titulo}</h1>
    ${intro ? `<p class="pagina-intro">${intro}</p>` : ''}
    ${extra}
  </div>
</section>`,
  };
}

// ---------------------------------------------------------------------------
// Páginas

function paginaInicial() {
  const destaques = produtos.filter((p) => p.destaque);
  const selos = [
    ['factory', 'Fábrica própria'],
    ['package', `Pedido mínimo de ${empresa.pedidoMinimo} peças`],
    ['calendar-check', `Prazo médio de ${empresa.prazo}`],
    ['truck', 'Enviamos para todo o Brasil'],
  ];
  const motivos = [
    ['handshake', 'Atendimento personalizado', 'Ajudamos você a escolher tecido, modelo e personalização para cada função.'],
    ['factory', 'Qualidade com preço de fábrica', 'Produção própria em Curitiba, sem intermediários.'],
    ['shield-check', 'Segurança e conforto', 'Nylon impermeável, faixas refletivas e brim de alta resistência.'],
    ['calendar-check', 'Mais de três décadas de experiência', 'Desde 1990 atendendo de pequenas equipes a grandes frotas.'],
  ];
  const passos = [
    ['Solicite seu orçamento', 'Informe o tipo de uniforme e a quantidade.'],
    ['Defina o modelo', 'Ajudamos na escolha de tecidos, modelos e personalização.'],
    ['Produção sob medida', `Prazo médio de ${empresa.prazo}.`],
    ['Receba seu pedido', 'Envio para todo o Brasil ou retirada na loja.'],
  ];

  const conteudo = `
<section class="hero">
  <div class="container hero-grade">
    <div class="hero-texto">
      <p class="sobretitulo">Fábrica de uniformes em Curitiba desde 1990</p>
      <h1 class="hero-titulo">Uniformes <span class="destaque">que representam</span> <span class="script">sua marca.</span></h1>
      <p class="hero-sub">Há mais de 30 anos vestimos equipes de indústrias, hospitais, transporte e serviços com uniformes duráveis, confortáveis e com a cara da sua empresa.</p>
      <div class="acoes">
        <a class="btn btn-ouro btn-grande" href="${linkWhats(MSG_GERAL)}" target="_blank" rel="noopener">${icone('whatsapp-logo')}Pedir orçamento</a>
        <a class="btn btn-contorno btn-grande" href="/produtos/">Ver produtos</a>
      </div>
    </div>
    <div class="hero-fotos">
      <div class="hero-foto hero-foto-a">${foto('jaqueta-nylon-feminina-2', 'Mulher vestindo jaqueta de nylon azul-marinho da Marruá', { prioridade: true, sizes: '(min-width: 1024px) 28vw, 55vw' })}</div>
      <div class="hero-foto hero-foto-b">${foto('jaleco-branco', 'Mulher vestindo jaleco branco de manga longa', { prioridade: true, sizes: '(min-width: 1024px) 17vw, 38vw' })}</div>
      <div class="hero-foto hero-foto-c">${foto('camisa-de-brim', 'Homem vestindo camisa de brim com faixas refletivas e boné', { sizes: '(min-width: 1024px) 17vw, 38vw' })}</div>
    </div>
  </div>
  <div class="container">
    <ul class="selos">
      ${selos.map(([ic, txt]) => `<li>${icone(ic)}<span>${esc(txt)}</span></li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="secao secao-branca">
  <div class="container">
    ${blocoNumeros()}
    <h2 class="titulo-clientes">Empresas que já confiam na Marruá</h2>
    ${blocoClientes()}
  </div>
</section>

<section class="secao secao-marinho" id="segmentos">
  <div class="container">
    <h2 class="titulo">Uniformes para cada setor</h2>
    <p class="secao-intro">Cada operação tem sua rotina. Escolha o seu setor e veja os uniformes que fazemos para ele.</p>
    <ul class="segmentos-grade">
      ${segmentos
        .map(
          (s) => `<li><a class="segmento" href="/segmentos/${s.slug}/">
        ${icone(s.icone, 'segmento-icone')}
        <span class="segmento-nome">${esc(s.nome)}</span>
        <span class="segmento-resumo">${esc(s.resumo)}</span>
        ${icone('arrow-right', 'segmento-seta')}
      </a></li>`
        )
        .join('\n      ')}
      <li><a class="segmento segmento-outro" href="/orcamento/">
        ${icone('ruler', 'segmento-icone')}
        <span class="segmento-nome">Outro setor?</span>
        <span class="segmento-resumo">Desenvolvemos o uniforme sob medida para a sua operação.</span>
        ${icone('arrow-right', 'segmento-seta')}
      </a></li>
    </ul>
  </div>
</section>

<section class="secao">
  <div class="container">
    <div class="secao-cabeca">
      <h2 class="titulo">Produtos em destaque</h2>
      <a class="link-seta" href="/produtos/">Ver todos os ${produtos.length} produtos ${icone('arrow-right')}</a>
    </div>
    <div class="grade-produtos grade-rolagem">
      ${destaques.map(cardProduto).join('\n')}
    </div>
  </div>
</section>

<section class="secao secao-branca">
  <div class="container motivos">
    <div class="motivos-foto">${foto('polo-bordada-costas', 'Costas de camisa polo azul-marinho com a bandeira do Brasil bordada', { sizes: '(min-width: 1024px) 40vw, 90vw' })}</div>
    <div class="motivos-texto">
      <h2 class="titulo">Por que a Marruá</h2>
      <ul class="motivos-lista">
        ${motivos.map(([ic, t, d]) => `<li>${icone(ic)}<h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('\n        ')}
      </ul>
    </div>
  </div>
</section>

<section class="secao">
  <div class="container">
    <h2 class="titulo">Como funciona</h2>
    <ol class="passos">
      ${passos.map(([t, d], i) => `<li><span class="passo-num" aria-hidden="true">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('\n      ')}
    </ol>
  </div>
</section>

<section class="secao secao-branca">
  <div class="container">
    <div class="secao-cabeca">
      <h2 class="titulo">O que dizem nossos clientes</h2>
      <a class="link-seta" href="${empresa.googleAvaliacoes}" target="_blank" rel="noopener">Ver avaliações no Google ${icone('arrow-up-right')}</a>
    </div>
    <div class="depoimentos">
      ${depoimentos
        .map(
          (d) => `<figure class="depoimento">
        <div class="estrelas" role="img" aria-label="Nota ${d.nota} de 5">${icone('star-cheia').repeat(d.nota)}</div>
        <blockquote><p>“${esc(d.texto)}”</p></blockquote>
        <figcaption>${esc(d.nome)}<span>Avaliação no Google</span></figcaption>
      </figure>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>

${ctaFinal()}`;

  return pagina({
    rota: '/',
    titulo: 'Uniformes Profissionais em Curitiba | Marruá Uniformes',
    descricao: 'Fábrica de uniformes profissionais em Curitiba desde 1990. Jalecos, jaquetas, brim e linha social para empresas de todo o Brasil. Peça seu orçamento.',
    conteudo,
    jsonld: [negocioLocal],
  });
}

function paginaProdutos() {
  const topo = topoPagina({
    itens: [{ nome: 'Início', rota: '/' }, { nome: 'Produtos', rota: '/produtos/' }],
    titulo: 'Linha completa de uniformes profissionais',
    intro: `Do chão de fábrica à recepção, uniformes sob medida com a identidade da sua empresa. Pedido mínimo de ${empresa.pedidoMinimo} peças e prazo médio de ${empresa.prazo}.`,
  });
  const conteudo = `${topo.html}
<section class="secao secao-catalogo">
  <div class="container">
    <h2 class="sr">Catálogo de produtos</h2>
    <div class="filtro" role="group" aria-label="Filtrar produtos por segmento" data-filtro>
      <button type="button" class="chip" aria-pressed="true" data-segmento="todos">Todos</button>
      ${segmentos.map((s) => `<button type="button" class="chip" aria-pressed="false" data-segmento="${s.slug}">${esc(s.nome)}</button>`).join('\n      ')}
    </div>
    <p class="filtro-status" aria-live="polite" data-filtro-status>${produtos.length} produtos</p>
    <div class="grade-produtos" data-grade>
      ${produtos.map(cardProduto).join('\n')}
    </div>
    <p class="vazio" hidden data-vazio>Ainda não temos produtos cadastrados neste segmento. <a href="/orcamento/">Peça um uniforme sob medida</a>.</p>
  </div>
</section>
<section class="secao">
  <div class="container">
    <div class="faixa-escura">
      <div>
        <h2 class="titulo">Não encontrou o que precisa?</h2>
        <p>Desenvolvemos o uniforme sob medida para a sua operação.</p>
      </div>
      <a class="btn btn-ouro btn-grande" href="/orcamento/">Pedir orçamento</a>
    </div>
  </div>
</section>`;
  return pagina({
    rota: '/produtos/',
    titulo: 'Produtos: uniformes profissionais sob medida | Marruá Uniformes',
    descricao: `Catálogo com ${produtos.length} uniformes profissionais: jalecos, jaquetas, brim, aventais e mais. Pedido mínimo de ${empresa.pedidoMinimo} peças. Fábrica em Curitiba.`,
    conteudo,
    jsonld: [topo.jsonld],
  });
}

function paginaProduto(p) {
  const rota = `/produtos/${p.slug}/`;
  const m = migalhas([
    { nome: 'Início', rota: '/' },
    { nome: 'Produtos', rota: '/produtos/' },
    { nome: p.nome, rota },
  ]);
  const segs = p.segmentos.map((s) => segmentoPorSlug[s]);
  const principal = p.imagens[0];

  const miniaturas =
    p.imagens.length > 1
      ? `<div class="galeria-miniaturas">
        ${p.imagens
          .map((im, i) => {
            const { w } = tamanhoImagem(im.arquivo + '.webp');
            return `<button type="button" class="miniatura" aria-pressed="${i === 0}" aria-label="Ver foto ${i + 1} de ${p.imagens.length}" data-src="/img/${im.arquivo}.webp" data-srcset="/img/${im.arquivo}-600.webp 600w, /img/${im.arquivo}.webp ${w}w" data-alt="${esc(im.alt)}">${foto(im.arquivo, '', { sizes: '96px' })}</button>`;
          })
          .join('\n        ')}
      </div>`
      : '';

  const lista = (titulo, itens) =>
    itens.length ? `<div class="produto-lista"><h2>${titulo}</h2><ul>${itens.map((i) => `<li>${icone('check')}${esc(i)}</li>`).join('')}</ul></div>` : '';

  const relacionados = produtos
    .filter((o) => o.slug !== p.slug)
    .map((o) => ({ o, comum: o.segmentos.filter((s) => p.segmentos.includes(s)).length }))
    .filter((x) => x.comum > 0)
    .sort((a, b) => b.comum - a.comum)
    .slice(0, 4)
    .map((x) => x.o);

  const conteudo = `<section class="pagina-topo pagina-topo-produto">
  <div class="container">${m.html}</div>
</section>
<section class="secao produto">
  <div class="container produto-grade">
    <div class="galeria" data-galeria>
      <div class="galeria-principal">${foto(principal.arquivo, principal.alt, { prioridade: true, sizes: '(min-width: 1024px) 50vw, 100vw' })}</div>
      ${miniaturas}
    </div>
    <div class="produto-info">
      <ul class="chips">${segs.map((s) => `<li><a class="chip" href="/segmentos/${s.slug}/">${esc(s.nome)}</a></li>`).join('')}</ul>
      <h1 class="titulo-pagina">${esc(p.nome)}</h1>
      <p class="produto-descricao">${esc(p.descricao)}</p>
      ${lista('Material', p.material)}
      ${lista('Características', p.caracteristicas)}
      ${blocoCondicoes()}
      <div class="acoes">
        <a class="btn btn-ouro btn-grande" href="${linkWhats(msgProduto(p))}" target="_blank" rel="noopener">${icone('whatsapp-logo')}Pedir orçamento deste produto</a>
        <a class="btn btn-contorno btn-grande" href="/orcamento/?produto=${p.slug}">Preencher formulário</a>
      </div>
    </div>
  </div>
</section>
${
  relacionados.length
    ? `<section class="secao secao-branca">
  <div class="container">
    <h2 class="titulo">Produtos relacionados</h2>
    <div class="grade-produtos grade-rolagem">
      ${relacionados.map(cardProduto).join('\n')}
    </div>
  </div>
</section>`
    : ''
}
${ctaFinal({ mensagem: msgProduto(p) })}`;

  const produtoJsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nome,
    description: p.descricao,
    image: p.imagens.map((im) => `${site.url}/img/${im.arquivo}.webp`),
    url: site.url + rota,
    category: segs.map((s) => s.nome).join(', '),
    brand: { '@type': 'Brand', name: 'Marruá Uniformes' },
    manufacturer: { '@id': `${site.url}/#empresa` },
    ...(p.material.length ? { material: p.material.join(', ') } : {}),
  };

  return pagina({
    rota,
    titulo: `${p.nome} | Marruá Uniformes Curitiba`,
    descricao: `${p.descricao} Pedido mínimo de ${empresa.pedidoMinimo} peças, prazo médio de ${empresa.prazo}.`,
    conteudo,
    jsonld: [produtoJsonld, m.jsonld],
    mensagemWhats: msgProduto(p),
  });
}

function paginaSegmento(s) {
  const rota = `/segmentos/${s.slug}/`;
  const m = migalhas([
    { nome: 'Início', rota: '/' },
    { nome: 'Produtos', rota: '/produtos/' },
    { nome: s.nome, rota },
  ]);
  const lista = produtos.filter((p) => p.segmentos.includes(s.slug));
  const outros = segmentos.filter((o) => o.slug !== s.slug);

  const conteudo = `<section class="pagina-topo pagina-topo-segmento">
  <div class="container topo-segmento">
    <div class="topo-segmento-texto">
      ${m.html}
      ${icone(s.icone, 'topo-segmento-icone')}
      <h1 class="titulo-pagina">${esc(s.titulo)}</h1>
      <p class="pagina-intro">${esc(s.intro)}</p>
      <div class="acoes">
        <a class="btn btn-ouro btn-grande" href="${linkWhats(msgSegmento(s))}" target="_blank" rel="noopener">${icone('whatsapp-logo')}Pedir orçamento</a>
        <a class="btn btn-contorno btn-grande" href="#produtos-do-segmento">Ver produtos</a>
      </div>
    </div>
    <div class="topo-segmento-foto">${foto(s.imagem, '', { prioridade: true, sizes: '(min-width: 1024px) 34vw, 90vw' })}</div>
  </div>
</section>
<section class="secao" id="produtos-do-segmento">
  <div class="container">
    <h2 class="titulo">${lista.length === 1 ? 'Produto' : 'Produtos'} para ${esc(s.nome.toLowerCase())}</h2>
    <div class="grade-produtos">
      ${lista.map(cardProduto).join('\n')}
    </div>
    ${blocoCondicoes()}
  </div>
</section>
<section class="secao secao-branca">
  <div class="container">
    <h2 class="titulo titulo-menor">Outros segmentos</h2>
    <ul class="chips chips-grandes">${outros.map((o) => `<li><a class="chip" href="/segmentos/${o.slug}/">${icone(o.icone)}${esc(o.nome)}</a></li>`).join('')}</ul>
  </div>
</section>
${ctaFinal({ mensagem: msgSegmento(s) })}`;

  return pagina({
    rota,
    titulo: `${s.titulo} | Marruá Uniformes`,
    descricao: `${s.intro} Fábrica em Curitiba desde 1990, pedido mínimo de ${empresa.pedidoMinimo} peças.`,
    conteudo,
    jsonld: [m.jsonld],
    mensagemWhats: msgSegmento(s),
  });
}

function paginaQuemSomos() {
  const topo = topoPagina({
    itens: [{ nome: 'Início', rota: '/' }, { nome: 'Quem somos', rota: '/quem-somos/' }],
    titulo: 'Uma empresa de família que veste o trabalho de muitas outras',
  });
  const [fundador1, fundador2] = empresa.fundadores;
  const [gestor1, gestor2] = empresa.gestao;

  const conteudo = `${topo.html}
<section class="secao secao-sobre">
  <div class="container sobre-grade">
    <div class="sobre-texto">
      <p class="sobre-abre">A Marruá nasceu em 18 de maio de 1990, em Curitiba, pelas mãos de ${fundador1.split(' ')[0]} e ${esc(fundador2)}.</p>
      <p>Hoje, sob a gestão de ${esc(gestor1)} e ${esc(gestor2)}, seguimos com o mesmo propósito: desenvolver uniformes profissionais com conforto, segurança e boa apresentação para empresas de diferentes segmentos.</p>
      <p>Atendemos empresas de Curitiba, da região metropolitana e de todo o Brasil, com qualidade, compromisso, transparência e foco na satisfação de cada cliente.</p>
    </div>
    <div class="sobre-fotos">
      <div class="sobre-foto">${foto('polo-feminina', 'Mulher vestindo camisa polo azul-marinho', { sizes: '(min-width: 1024px) 22vw, 45vw' })}</div>
      <div class="sobre-foto">${foto('jaqueta-tecido-masculina', 'Homem vestindo jaqueta bicolor em tecido', { sizes: '(min-width: 1024px) 22vw, 45vw' })}</div>
    </div>
  </div>
</section>

<section class="secao secao-branca">
  <div class="container">
    <h2 class="titulo">Nossa história</h2>
    <ol class="linha-tempo">
      <li><span class="ano">1990</span><h3>Fundação</h3><p>${esc(fundador1)} e ${esc(fundador2)} abrem a Marruá em Curitiba.</p></li>
      <li><span class="ano">Hoje</span><h3>Segunda geração</h3><p>${esc(gestor1)} e ${esc(gestor2)} conduzem a empresa, com loja e fábrica no bairro ${esc(endereco.bairro)}.</p></li>
    </ol>
  </div>
</section>

<section class="secao">
  <div class="container">
    <h2 class="sr">Missão, visão e valores</h2>
    <div class="mvv">
      <article class="mvv-item mvv-marinho">${icone('t-shirt')}<h3>Missão</h3><p>Desenvolver uniformes profissionais com conforto, segurança e boa apresentação para empresas de diferentes segmentos.</p></article>
      <article class="mvv-item mvv-grafite">${icone('ruler')}<h3>Visão</h3><p>Fornecer soluções customizadas, considerando as necessidades específicas de cada operação.</p></article>
      <article class="mvv-item mvv-ouro">${icone('handshake')}<h3>Valores</h3><p>Qualidade, compromisso, transparência e foco na satisfação de cada cliente.</p></article>
    </div>
  </div>
</section>

<section class="secao secao-branca">
  <div class="container">
    ${blocoNumeros()}
    <h2 class="titulo-clientes">Empresas que já confiam na Marruá</h2>
    ${blocoClientes()}
  </div>
</section>

${ctaFinal()}`;

  return pagina({
    rota: '/quem-somos/',
    titulo: 'Quem somos: fábrica de uniformes desde 1990 | Marruá Uniformes',
    descricao: 'Empresa familiar fundada em 1990 em Curitiba. Conheça a história, a missão e os valores da Marruá Uniformes Profissionais.',
    conteudo,
    jsonld: [negocioLocal, topo.jsonld],
  });
}

function paginaOrcamento() {
  const topo = topoPagina({
    itens: [{ nome: 'Início', rota: '/' }, { nome: 'Orçamento', rota: '/orcamento/' }],
    titulo: 'Solicite seu orçamento',
    intro: 'Conte o que sua equipe precisa. Respondemos rapidinho pelo WhatsApp ou por <span class="sem-quebra">e-mail</span>.',
  });

  const campo = (id, rotulo, controle, ajuda = '') => `<div class="campo">
        <label for="${id}">${rotulo}</label>
        ${controle}
        ${ajuda ? `<p class="campo-ajuda" id="ajuda-${id}">${ajuda}</p>` : ''}
        <p class="campo-erro" id="erro-${id}" hidden></p>
      </div>`;
  const descr = (id, ajuda) => `aria-describedby="${ajuda ? `ajuda-${id} ` : ''}erro-${id}"`;

  const conteudo = `${topo.html}
<section class="secao secao-orcamento">
  <div class="container orcamento-grade">
    <form class="form" action="/obrigado/" method="get" novalidate data-form-orcamento data-whats="${empresa.whatsappNumero}" data-endpoint="${esc(site.formEndpoint)}">
      <noscript><p class="aviso">Para enviar o formulário, ative o JavaScript ou chame a gente direto no <a href="${linkWhats(MSG_GERAL)}">WhatsApp</a>.</p></noscript>
      <div class="form-linha">
      ${campo('nome', 'Nome', `<input id="nome" name="nome" type="text" autocomplete="name" required ${descr('nome')}>`)}
      ${campo('telefone', 'Telefone ou WhatsApp', `<input id="telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" required ${descr('telefone')}>`)}
      </div>
      <div class="form-linha">
      ${campo('empresa', 'Empresa', `<input id="empresa" name="empresa" type="text" autocomplete="organization" ${descr('empresa')}>`)}
      ${campo('email', 'E-mail <span>(opcional)</span>', `<input id="email" name="email" type="email" autocomplete="email" ${descr('email')}>`)}
      </div>
      <div class="form-linha">
      ${campo(
        'segmento',
        'Segmento',
        `<select id="segmento" name="segmento" ${descr('segmento')}>
          <option value="">Selecione</option>
          ${segmentos.map((s) => `<option value="${s.slug}">${esc(s.nome)}</option>`).join('\n          ')}
          <option value="outro">Outro</option>
        </select>`
      )}
      ${campo(
        'produto',
        'Produto de interesse',
        `<select id="produto" name="produto" ${descr('produto')}>
          <option value="">Ainda não sei / outro</option>
          ${produtos.map((p) => `<option value="${p.slug}">${esc(p.nome)}</option>`).join('\n          ')}
        </select>`
      )}
      </div>
      ${campo(
        'quantidade',
        'Quantidade de peças',
        `<input id="quantidade" name="quantidade" type="number" inputmode="numeric" min="${empresa.pedidoMinimo}" step="1" required ${descr('quantidade', true)}>`,
        `Pedido mínimo de ${empresa.pedidoMinimo} peças.`
      )}
      ${campo('mensagem', 'Mensagem <span>(opcional)</span>', `<textarea id="mensagem" name="mensagem" rows="4" ${descr('mensagem')} placeholder="Ex.: cores, bordado do logo, tamanhos, data de entrega"></textarea>`)}
      <div class="campo campo-aceite">
        <input id="aceite" name="aceite" type="checkbox" required aria-describedby="erro-aceite">
        <label for="aceite">Li e aceito a <a href="/politica-de-privacidade/" target="_blank">Política de Privacidade</a>.</label>
        <p class="campo-erro" id="erro-aceite" hidden></p>
      </div>
      <button class="btn btn-ouro btn-grande btn-bloco" type="submit">${icone('whatsapp-logo')}Enviar pelo WhatsApp</button>
      <p class="form-nota">O WhatsApp abre com a sua mensagem pronta. É só tocar em enviar.</p>
    </form>

    <aside class="orcamento-lado">
      <div class="lado-escuro">
        <h2>Como trabalhamos</h2>
        ${blocoCondicoes()}
        <p class="lado-entrega">${icone('truck')}Envio para todo o Brasil ou retirada na loja.</p>
      </div>
      <div class="lado-alternativas">
        <h2>Prefere falar direto?</h2>
        <a class="contato-linha" href="${linkWhats(MSG_GERAL)}" target="_blank" rel="noopener">${icone('whatsapp-logo')}<span><strong>WhatsApp</strong>${empresa.whatsapp}</span></a>
        <a class="contato-linha" href="tel:${empresa.telefoneLink}">${icone('phone')}<span><strong>Telefone</strong>${empresa.telefone}</span></a>
        <a class="contato-linha" href="mailto:${empresa.email}">${icone('envelope-simple')}<span><strong>E-mail</strong>${empresa.email}</span></a>
      </div>
    </aside>
  </div>
</section>`;

  return pagina({
    rota: '/orcamento/',
    titulo: 'Orçamento de uniformes profissionais | Marruá Uniformes',
    descricao: `Peça um orçamento de uniformes para a sua empresa. Pedido mínimo de ${empresa.pedidoMinimo} peças, prazo médio de ${empresa.prazo} e envio para todo o Brasil.`,
    conteudo,
    jsonld: [topo.jsonld],
  });
}

function paginaContato() {
  const topo = topoPagina({
    itens: [{ nome: 'Início', rota: '/' }, { nome: 'Contato', rota: '/contato/' }],
    titulo: 'Fale com a Marruá',
    intro: 'Venha conhecer nossos tecidos e modelos pessoalmente, ou fale com a gente pelo canal que preferir.',
  });
  const urlMapa = `https://www.google.com/maps?q=${encodeURIComponent(`${endereco.rua} - ${endereco.bairro}, ${endereco.cidade} - ${endereco.uf}, ${endereco.cep}`)}&output=embed`;

  const conteudo = `${topo.html}
<section class="secao secao-contato">
  <div class="container contato-grade">
    <div class="contato-lista">
      <a class="contato-linha" href="${linkMapa}" target="_blank" rel="noopener">${icone('map-pin')}<span><strong>Endereço</strong>${esc(endereco.rua)}<br>${esc(endereco.bairro)}, ${esc(endereco.cidade)}/${endereco.uf}, CEP ${endereco.cep}</span></a>
      ${empresa.horario ? `<p class="contato-linha">${icone('clock')}<span><strong>Horário</strong>${esc(empresa.horario)}</span></p>` : ''}
      <a class="contato-linha" href="tel:${empresa.telefoneLink}">${icone('phone')}<span><strong>Telefone</strong>${empresa.telefone}</span></a>
      <a class="contato-linha" href="${linkWhats(MSG_GERAL)}" target="_blank" rel="noopener">${icone('whatsapp-logo')}<span><strong>WhatsApp</strong>${empresa.whatsapp}</span></a>
      <a class="contato-linha" href="mailto:${empresa.email}">${icone('envelope-simple')}<span><strong>E-mail</strong>${empresa.email}</span></a>
      <a class="contato-linha" href="${empresa.instagram}" target="_blank" rel="noopener">${icone('instagram-logo')}<span><strong>Instagram</strong>@marruauniformes</span></a>
      <a class="contato-linha" href="${empresa.facebook}" target="_blank" rel="noopener">${icone('facebook-logo')}<span><strong>Facebook</strong>Marruá Uniformes</span></a>
    </div>
    <div class="mapa" data-mapa data-src="${esc(urlMapa)}">
      <div class="mapa-capa">
        ${icone('map-trifold', 'mapa-icone')}
        <p><strong>${esc(endereco.rua)}</strong><br>${esc(endereco.bairro)}, ${esc(endereco.cidade)}/${endereco.uf}</p>
        <div class="acoes">
          <button type="button" class="btn btn-ouro" data-mapa-carregar>Carregar mapa</button>
          <a class="btn btn-contorno" href="${linkMapa}" target="_blank" rel="noopener">Abrir no Google Maps</a>
        </div>
        <p class="mapa-nota">O mapa é carregado do Google Maps só quando você pede.</p>
      </div>
    </div>
  </div>
</section>`;

  return pagina({
    rota: '/contato/',
    titulo: 'Contato e endereço em Curitiba | Marruá Uniformes',
    descricao: `Loja e fábrica na ${endereco.rua}, ${endereco.bairro}, Curitiba. Telefone ${empresa.telefone}, WhatsApp ${empresa.whatsapp} e e-mail ${empresa.email}.`,
    conteudo,
    jsonld: [negocioLocal, topo.jsonld],
  });
}

function paginaObrigado() {
  const conteudo = `<section class="secao obrigado">
  <div class="container obrigado-grade">
    <img class="obrigado-mascote" src="/img/mascote.webp" width="508" height="845" alt="Mascote da Marruá fazendo sinal de positivo" fetchpriority="high">
    <div>
      <h1 class="titulo-pagina">Recebemos seu pedido de orçamento!</h1>
      <p class="pagina-intro">Em breve entraremos em contato.</p>
      <p class="obrigado-reenvio" hidden data-reenvio>O WhatsApp não abriu? <a href="#" target="_blank" rel="noopener" data-reenvio-link>Toque aqui para enviar a mensagem</a>.</p>
      <div class="acoes">
        <a class="btn btn-ouro btn-grande" href="/produtos/">Ver produtos</a>
        <a class="btn btn-contorno btn-grande" href="${empresa.instagram}" target="_blank" rel="noopener">${icone('instagram-logo')}Seguir no Instagram</a>
      </div>
    </div>
  </div>
</section>`;
  return pagina({
    rota: '/obrigado/',
    titulo: 'Pedido recebido | Marruá Uniformes',
    descricao: 'Recebemos seu pedido de orçamento. Em breve entraremos em contato.',
    conteudo,
    indexar: false,
  });
}

function paginaPrivacidade() {
  const topo = topoPagina({
    itens: [{ nome: 'Início', rota: '/' }, { nome: 'Política de Privacidade', rota: '/politica-de-privacidade/' }],
    titulo: 'Política de Privacidade',
    intro: 'Como a Marruá trata os dados pessoais de quem visita este site, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
  });
  const conteudo = `${topo.html}
<section class="secao secao-branca">
  <div class="container texto-longo">
    <h2>Quem somos</h2>
    <p>Este site pertence à ${esc(site.nome)}, com sede na ${esc(enderecoCompleto)}. Para qualquer assunto sobre seus dados, fale com a gente pelo e-mail <a href="mailto:${empresa.email}">${empresa.email}</a> ou pelo telefone ${empresa.telefone}. Respondemos em até 2 dias úteis.</p>

    <h2>Quais dados coletamos</h2>
    <p>Só coletamos os dados que você mesmo informa no formulário de orçamento: nome, telefone ou WhatsApp, empresa, e-mail, segmento, produto de interesse, quantidade de peças e mensagem.</p>
    <p>Este site não usa cookies de rastreamento, ferramentas de publicidade nem análise de audiência. As fontes e imagens são servidas pelo nosso próprio servidor.</p>

    <h2>Como os dados são usados</h2>
    <p>Usamos esses dados apenas para responder ao seu pedido de orçamento e dar andamento ao atendimento. Não vendemos nem compartilhamos seus dados para fins de publicidade.</p>

    <h2>Serviços de terceiros</h2>
    <p>Ao enviar o formulário, a mensagem é aberta no WhatsApp, serviço da Meta, e passa a seguir também a política de privacidade do WhatsApp. Na página de contato, o mapa do Google Maps só é carregado se você clicar em "Carregar mapa"; a partir daí, vale a política de privacidade do Google. Links para Instagram e Facebook levam a serviços com políticas próprias.</p>

    <h2>Por quanto tempo guardamos</h2>
    <p>Mantemos os dados pelo tempo necessário para o atendimento e para cumprir obrigações legais. Depois disso, eles são eliminados.</p>

    <h2>Seus direitos</h2>
    <p>Você pode pedir a confirmação do tratamento, o acesso, a correção ou a eliminação dos seus dados, além de exercer os demais direitos previstos na LGPD, pelo e-mail <a href="mailto:${empresa.email}">${empresa.email}</a>.</p>

    <h2>Dados de menores</h2>
    <p>Não tratamos dados de menores de 18 anos sem o consentimento do responsável. Dados recebidos nessa situação são eliminados.</p>

    <h2>Alterações</h2>
    <p>Esta política pode ser atualizada. A versão em vigor é sempre a publicada nesta página.</p>
  </div>
</section>`;
  return pagina({
    rota: '/politica-de-privacidade/',
    titulo: 'Política de Privacidade | Marruá Uniformes',
    descricao: 'Como a Marruá Uniformes Profissionais trata os dados pessoais de quem visita o site, conforme a LGPD.',
    conteudo,
    jsonld: [topo.jsonld],
  });
}

function pagina404() {
  const conteudo = `<section class="secao obrigado">
  <div class="container obrigado-grade">
    <img class="obrigado-mascote" src="/img/mascote.webp" width="508" height="845" alt="Mascote da Marruá">
    <div>
      <h1 class="titulo-pagina">Página não encontrada</h1>
      <p class="pagina-intro">O endereço pode ter mudado com o novo site. Veja nossos produtos ou fale com a gente.</p>
      <div class="acoes">
        <a class="btn btn-ouro btn-grande" href="/produtos/">Ver produtos</a>
        <a class="btn btn-contorno btn-grande" href="/">Ir para o início</a>
      </div>
    </div>
  </div>
</section>`;
  return pagina({
    rota: '/404.html',
    titulo: 'Página não encontrada | Marruá Uniformes',
    descricao: 'A página que você procurou não existe.',
    conteudo,
    indexar: false,
  });
}

// ---------------------------------------------------------------------------
// Arquivos de apoio: sitemap, robots e redirecionamentos 301

function redirecionamentos() {
  const lista = [];
  for (const p of produtos) for (const antiga of p.urlsAntigas || []) lista.push([antiga, `/produtos/${p.slug}/`]);
  for (const s of segmentos) for (const antiga of s.urlsAntigas || []) lista.push([antiga, `/segmentos/${s.slug}/`]);
  lista.push(['/category/uncategorized/', '/produtos/']);
  return lista;
}

function gerarArquivosDeApoio(rotas) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rotas.map((r) => `  <url><loc>${site.url}${r}</loc><lastmod>${HOJE}</lastmod></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

  const lista = redirecionamentos();
  // Netlify e Cloudflare Pages leem _redirects na raiz do site publicado.
  fs.writeFileSync(path.join(DIST, '_redirects'), lista.map(([de, para]) => `${de} ${para} 301`).join('\n') + '\n');
  // Para nginx: incluir dentro do bloco server { } com "include .../redirects-nginx.conf;"
  fs.writeFileSync(
    path.join(__dirname, 'redirects-nginx.conf'),
    lista.map(([de, para]) => `location = ${de} { return 301 ${para}; }\nlocation = ${de.replace(/\/$/, '')} { return 301 ${para}; }`).join('\n') + '\n'
  );
  return lista.length;
}

// ---------------------------------------------------------------------------

function main() {
  validarDados();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  fs.cpSync(path.join(__dirname, 'img'), path.join(DIST, 'img'), { recursive: true });
  fs.cpSync(path.join(__dirname, 'fonts'), path.join(DIST, 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'style.css'), path.join(DIST, 'style.css'));
  fs.copyFileSync(path.join(__dirname, 'site.js'), path.join(DIST, 'site.js'));

  const rotasIndexaveis = [];
  const publicar = (rota, html, indexar = true) => {
    escrever(rota, html);
    if (indexar) rotasIndexaveis.push(rota);
  };

  publicar('/', paginaInicial());
  publicar('/produtos/', paginaProdutos());
  for (const p of produtos) publicar(`/produtos/${p.slug}/`, paginaProduto(p));
  for (const s of segmentos) publicar(`/segmentos/${s.slug}/`, paginaSegmento(s));
  publicar('/quem-somos/', paginaQuemSomos());
  publicar('/orcamento/', paginaOrcamento());
  publicar('/contato/', paginaContato());
  publicar('/politica-de-privacidade/', paginaPrivacidade());
  publicar('/obrigado/', paginaObrigado(), false);
  publicar('/404.html', pagina404(), false);

  const total = gerarArquivosDeApoio(rotasIndexaveis);
  console.log(`Site gerado em dist/: ${rotasIndexaveis.length + 2} páginas, ${total} redirecionamentos.`);
}

main();
