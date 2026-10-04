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
  const alvos = document.querySelectorAll('.secao .titulo, .card, .segmento, .passos li, .motivos-lista li, .depoimento, .mvv-item, .linha-tempo li');
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
