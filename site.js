// Comportamentos do site. Cada bloco só roda se o elemento existir na página.

const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Menu do celular -----------------------------------------------------------
const menuBotao = document.querySelector('[data-menu-botao]');
if (menuBotao) {
  menuBotao.addEventListener('click', () => {
    const aberto = menuBotao.getAttribute('aria-expanded') === 'true';
    menuBotao.setAttribute('aria-expanded', String(!aberto));
    document.body.classList.toggle('menu-aberto', !aberto);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) {
      menuBotao.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-aberto');
      menuBotao.focus();
    }
  });
}

// Submenu "Segmentos" --------------------------------------------------------
const subBotao = document.querySelector('[data-sub-botao]');
if (subBotao) {
  const fechar = () => subBotao.setAttribute('aria-expanded', 'false');
  subBotao.addEventListener('click', () => {
    subBotao.setAttribute('aria-expanded', String(subBotao.getAttribute('aria-expanded') !== 'true'));
  });
  document.addEventListener('click', (e) => {
    if (!subBotao.parentElement.contains(e.target)) fechar();
  });
  subBotao.parentElement.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fechar();
      subBotao.focus();
    }
  });
}

// Sombra no cabeçalho depois de rolar (sem escutar o evento de scroll) --------
const topo = document.querySelector('.topo');
if (topo && 'IntersectionObserver' in window) {
  const marcador = document.createElement('div');
  marcador.style.cssText = 'position:absolute;top:0;height:8px;width:1px;pointer-events:none';
  document.body.prepend(marcador);
  new IntersectionObserver(([e]) => topo.classList.toggle('topo-rolado', !e.isIntersecting)).observe(marcador);
}

// Filtro do catálogo ---------------------------------------------------------
const filtro = document.querySelector('[data-filtro]');
if (filtro) {
  const cards = [...document.querySelectorAll('[data-grade] .card')];
  const status = document.querySelector('[data-filtro-status]');
  const vazio = document.querySelector('[data-vazio]');

  const aplicar = (segmento) => {
    let visiveis = 0;
    for (const card of cards) {
      const mostra = segmento === 'todos' || card.dataset.segmentos.split(' ').includes(segmento);
      card.hidden = !mostra;
      if (mostra) visiveis++;
    }
    for (const chip of filtro.querySelectorAll('.chip')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.segmento === segmento));
    }
    status.textContent = visiveis === 1 ? '1 produto' : `${visiveis} produtos`;
    vazio.hidden = visiveis > 0;
  };

  filtro.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    aplicar(chip.dataset.segmento);
    const url = new URL(location.href);
    if (chip.dataset.segmento === 'todos') url.searchParams.delete('segmento');
    else url.searchParams.set('segmento', chip.dataset.segmento);
    history.replaceState(null, '', url);
  });

  const inicial = new URLSearchParams(location.search).get('segmento');
  if (inicial && filtro.querySelector(`[data-segmento="${CSS.escape(inicial)}"]`)) aplicar(inicial);
}

// Galeria da página de produto -----------------------------------------------
const galeria = document.querySelector('[data-galeria]');
if (galeria) {
  const principal = galeria.querySelector('.galeria-principal img');
  galeria.addEventListener('click', (e) => {
    const mini = e.target.closest('.miniatura');
    if (!mini) return;
    principal.src = mini.dataset.src;
    principal.srcset = mini.dataset.srcset;
    principal.alt = mini.dataset.alt;
    for (const m of galeria.querySelectorAll('.miniatura')) m.setAttribute('aria-pressed', String(m === mini));
  });
}

// Contadores: o número final já está no HTML; aqui só animamos ---------------
if (!reduzirMovimento && 'IntersectionObserver' in window) {
  const contadores = document.querySelectorAll('[data-contador]');
  const animar = (el) => {
    const alvo = Number(el.dataset.contador);
    const inicio = performance.now();
    const duracao = 1200;
    const passo = (agora) => {
      const t = Math.min((agora - inicio) / duracao, 1);
      const suave = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(alvo * suave).toLocaleString('pt-BR');
      if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  };
  const obs = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) {
          animar(e.target);
          obs.unobserve(e.target);
        }
      }
    },
    { threshold: 0.6 }
  );
  contadores.forEach((c) => obs.observe(c));
}

// Entrada suave das seções ---------------------------------------------------
if (!reduzirMovimento && 'IntersectionObserver' in window) {
  const alvos = document.querySelectorAll('.secao .titulo, .card, .passos li, .motivos-lista li, .depoimento, .mvv-item, .linha-tempo li, .cta-mascote');
  const obs = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) {
          e.target.classList.add('visivel');
          obs.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
  alvos.forEach((el) => {
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.classList.add('revelar');
      obs.observe(el);
    }
  });
}

// Setores: abas que trocam a pessoa e os produtos do palco --------------------
const palco = document.querySelector('[data-setores]');
if (palco) {
  const abas = [...document.querySelectorAll('.setor-aba')];
  const paineis = [...palco.querySelectorAll('.setor-painel')];
  const selecionar = (aba, foco = false) => {
    for (const a of abas) {
      const ativa = a === aba;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
    }
    for (const p of paineis) p.classList.toggle('ativo', p.id === aba.getAttribute('aria-controls'));
    if (foco) aba.focus();
  };
  selecionar(abas[0]);

  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => selecionar(aba));
    if (window.matchMedia('(hover: hover)').matches) aba.addEventListener('mouseenter', () => selecionar(aba));
    aba.addEventListener('keydown', (e) => {
      const passo = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (passo) {
        e.preventDefault();
        selecionar(abas[(i + passo + abas.length) % abas.length], true);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        selecionar(e.key === 'Home' ? abas[0] : abas[abas.length - 1], true);
      }
    });
  });

  // Quando o palco se aproxima da tela, carrega as fotos de todas as abas para a troca ser instantânea.
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        palco.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
        obs.disconnect();
      },
      { rootMargin: '300px' }
    );
    obs.observe(palco);
  }
}

// Noite: o feixe de luz só roda enquanto a seção está na tela ----------------
const noite = document.querySelector('[data-noite]');
if (noite && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => noite.classList.toggle('ativo', e.isIntersecting), { threshold: 0.25 }).observe(noite);
}

// Simulador: aplica o logo enviado na peça, tudo no navegador ---------------
const sim = document.querySelector('[data-sim]');
if (sim) {
  const pecas = JSON.parse(sim.dataset.pecas);
  const fotoPeca = sim.querySelector('[data-sim-peca]');
  const imgLogo = sim.querySelector('[data-sim-logo]');
  const status = document.querySelector('[data-sim-status]');
  const linkWhatsSim = document.querySelector('[data-sim-whats]');
  const CORES = { branco: [255, 255, 255], preto: [20, 22, 28], dourado: [226, 176, 74] };
  let original = null; // logo atual, já sem fundo branco
  let peca = pecas[0];
  let corManual = false;

  const carregar = (src) =>
    new Promise((ok, falha) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = falha;
      im.src = src;
    });

  // Logos em JPG costumam ter fundo branco: se os quatro cantos forem brancos, tiramos esse fundo.
  const tirarFundoBranco = (im) => {
    const largura = im.naturalWidth || 600;
    const altura = im.naturalHeight || 300;
    const escala = Math.min(1, 900 / Math.max(largura, altura));
    const c = document.createElement('canvas');
    c.width = Math.round(largura * escala);
    c.height = Math.round(altura * escala);
    const ctx = c.getContext('2d');
    ctx.drawImage(im, 0, 0, c.width, c.height);
    const dados = ctx.getImageData(0, 0, c.width, c.height);
    const px = dados.data;
    const branco = (x, y) => {
      const i = (y * c.width + x) * 4;
      return px[i + 3] > 250 && px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235;
    };
    if (branco(0, 0) && branco(c.width - 1, 0) && branco(0, c.height - 1) && branco(c.width - 1, c.height - 1)) {
      for (let i = 0; i < px.length; i += 4) {
        const claro = Math.min(px[i], px[i + 1], px[i + 2]);
        if (claro > 245) px[i + 3] = 0;
        else if (claro > 215) px[i + 3] = Math.round(px[i + 3] * ((245 - claro) / 30));
      }
      ctx.putImageData(dados, 0, 0);
    }
    return c;
  };

  const corEscolhida = () => document.querySelector('input[name="sim-cor"]:checked').value;

  // Logo na cor escolhida (bordado de uma cor) ou nas cores originais.
  const logoNaCor = () => {
    if (!original) return null;
    const cor = CORES[corEscolhida()];
    if (!cor) return original;
    const c = document.createElement('canvas');
    c.width = original.width;
    c.height = original.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(original, 0, 0);
    const dados = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < dados.data.length; i += 4) {
      dados.data[i] = cor[0];
      dados.data[i + 1] = cor[1];
      dados.data[i + 2] = cor[2];
    }
    ctx.putImageData(dados, 0, 0);
    return c;
  };

  const desenhar = () => {
    const c = logoNaCor();
    if (c) imgLogo.src = c.toDataURL('image/png');
  };

  const mensagem = () => `Olá, Marruá! Testei meu logo no simulador do site (peça: ${peca.nome}) e gostaria de um orçamento.`;

  const trocarPeca = (indice) => {
    peca = pecas[indice];
    fotoPeca.src = `/img/${peca.foto}.webp`;
    fotoPeca.alt = peca.alt;
    sim.style.setProperty('--x', peca.x);
    sim.style.setProperty('--y', peca.y);
    sim.style.setProperty('--w', peca.largura);
    if (!corManual) document.querySelector(`input[name="sim-cor"][value="${peca.cor}"]`).checked = true;
    linkWhatsSim.href = linkWhatsSim.href.split('?')[0] + '?text=' + encodeURIComponent(mensagem());
    desenhar();
  };

  // O logo de exemplo só é processado quando o simulador chega perto da tela.
  const iniciar = () =>
    carregar('/img/logo.webp').then((im) => {
      if (!original) {
        original = tirarFundoBranco(im);
        desenhar();
      }
    });
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        iniciar();
      },
      { rootMargin: '400px' }
    );
    obs.observe(sim);
  } else {
    iniciar();
  }

  document.querySelector('[data-sim-arquivo]').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    status.classList.remove('erro');
    if (!arquivo.type.startsWith('image/')) {
      status.textContent = 'Esse arquivo não é uma imagem. Envie PNG, JPG, WEBP ou SVG.';
      status.classList.add('erro');
      return;
    }
    const url = URL.createObjectURL(arquivo);
    try {
      original = tirarFundoBranco(await carregar(url));
      document.querySelector('input[name="sim-cor"][value="original"]').checked = true;
      corManual = true;
      desenhar();
      status.textContent = 'Pronto! Seu logo foi aplicado. Experimente outras peças e cores.';
    } catch (_) {
      status.textContent = 'Não consegui abrir essa imagem. Tente um PNG ou JPG.';
      status.classList.add('erro');
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  document.querySelectorAll('input[name="sim-peca"]').forEach((r) => r.addEventListener('change', () => trocarPeca(Number(r.value))));
  document.querySelectorAll('input[name="sim-cor"]').forEach((r) =>
    r.addEventListener('change', () => {
      corManual = true;
      desenhar();
    })
  );
  document.querySelector('[data-sim-tamanho]').addEventListener('input', (e) => sim.style.setProperty('--tamanho', e.target.value / 100));

  // Baixar: monta a foto inteira da peça com o logo, no tamanho original.
  document.querySelector('[data-sim-baixar]').addEventListener('click', async () => {
    const base = await carregar(fotoPeca.src);
    const logo = logoNaCor();
    const c = document.createElement('canvas');
    c.width = base.naturalWidth;
    c.height = base.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    if (logo) {
      const tamanho = Number(sim.style.getPropertyValue('--tamanho') || 1);
      const lw = c.width * peca.largura * tamanho;
      const lh = (lw * logo.height) / logo.width;
      ctx.drawImage(logo, c.width * peca.x - lw / 2, c.height * peca.y - lh / 2, lw, lh);
    }
    const a = document.createElement('a');
    a.download = `marrua-${peca.foto}-com-seu-logo.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  });
}

// Balão do mascote: aparece uma vez por visita, depois de um tempo na página --
const balao = document.querySelector('[data-balao]');
if (balao && !/^\/(orcamento|obrigado)\//.test(location.pathname)) {
  let visto = false;
  try {
    visto = sessionStorage.getItem('marrua-balao') === '1';
  } catch (_) {
    // sem sessionStorage o balão pode aparecer de novo; não é grave
  }
  const guardar = () => {
    try {
      sessionStorage.setItem('marrua-balao', '1');
    } catch (_) {}
  };
  if (!visto) {
    const mostrar = setTimeout(() => {
      balao.hidden = false;
      guardar();
      setTimeout(() => (balao.hidden = true), 12000);
    }, 15000);
    balao.querySelector('[data-balao-fechar]').addEventListener('click', () => {
      balao.hidden = true;
      clearTimeout(mostrar);
      guardar();
    });
  }
}

// Mapa carregado só quando a pessoa pede -------------------------------------
const mapa = document.querySelector('[data-mapa]');
if (mapa) {
  mapa.querySelector('[data-mapa-carregar]').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = mapa.dataset.src;
    iframe.title = 'Mapa com a localização da Marruá Uniformes';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    mapa.replaceChildren(iframe);
  });
}

// Formulário de orçamento: monta a mensagem e abre o WhatsApp ----------------
const form = document.querySelector('[data-form-orcamento]');
if (form) {
  const campos = form.elements;
  const minimo = Number(campos.quantidade.min);

  const produtoNaUrl = new URLSearchParams(location.search).get('produto');
  if (produtoNaUrl && [...campos.produto.options].some((o) => o.value === produtoNaUrl)) {
    campos.produto.value = produtoNaUrl;
  }

  const mostrarErro = (campo, mensagem) => {
    const erro = document.getElementById('erro-' + campo.id);
    erro.textContent = mensagem;
    erro.hidden = !mensagem;
    campo.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  };

  const validar = (campo) => {
    let msg = '';
    if (campo === campos.nome && !campo.value.trim()) msg = 'Informe seu nome.';
    if (campo === campos.telefone && campo.value.replace(/\D/g, '').length < 10) msg = 'Informe um telefone com DDD.';
    if (campo === campos.email && campo.value && !campo.validity.valid) msg = 'Confira o e-mail.';
    if (campo === campos.quantidade) {
      const q = Number(campo.value);
      if (!campo.value) msg = 'Informe a quantidade de peças.';
      else if (q < minimo) msg = `O pedido mínimo é de ${minimo} peças.`;
    }
    if (campo === campos.aceite && !campo.checked) msg = 'É preciso aceitar a Política de Privacidade.';
    mostrarErro(campo, msg);
    return !msg;
  };

  const obrigatorios = [campos.nome, campos.telefone, campos.email, campos.quantidade, campos.aceite];
  obrigatorios.forEach((c) => c.addEventListener('blur', () => c.value !== '' && validar(c)));
  campos.quantidade.addEventListener('input', () => validar(campos.quantidade));

  const textoDaOpcao = (select) => (select.value ? select.options[select.selectedIndex].text : '');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalidos = obrigatorios.filter((c) => !validar(c));
    if (invalidos.length) {
      invalidos[0].focus();
      return;
    }

    const detalhes = [
      `Nome: ${campos.nome.value.trim()}`,
      campos.empresa.value.trim() && `Empresa: ${campos.empresa.value.trim()}`,
      `Telefone: ${campos.telefone.value.trim()}`,
      campos.email.value.trim() && `E-mail: ${campos.email.value.trim()}`,
      campos.segmento.value && `Segmento: ${textoDaOpcao(campos.segmento)}`,
      campos.produto.value && `Produto: ${textoDaOpcao(campos.produto)}`,
      `Quantidade: ${campos.quantidade.value} peças`,
      campos.mensagem.value.trim() && `Mensagem: ${campos.mensagem.value.trim()}`,
    ].filter(Boolean);
    const texto = ['Olá, Marruá! Vim pelo site e gostaria de um orçamento.', '', ...detalhes].join('\n');
    const linkWhats = `https://wa.me/${form.dataset.whats}?text=${encodeURIComponent(texto)}`;

    // Envio opcional por e-mail (Formspree, Web3Forms ou endpoint próprio).
    if (form.dataset.endpoint) {
      fetch(form.dataset.endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, keepalive: true }).catch(() => {});
    }

    try {
      sessionStorage.setItem('marrua-whats', linkWhats);
    } catch (_) {
      // sem sessionStorage a página de obrigado só não mostra o link de reenvio
    }
    window.open(linkWhats, '_blank', 'noopener');
    location.href = '/obrigado/';
  });
}

// Página de obrigado: link para reenviar caso o WhatsApp não tenha aberto -----
const reenvio = document.querySelector('[data-reenvio]');
if (reenvio) {
  let link = null;
  try {
    link = sessionStorage.getItem('marrua-whats');
  } catch (_) {}
  if (link) {
    reenvio.querySelector('[data-reenvio-link]').href = link;
    reenvio.hidden = false;
  }
}
