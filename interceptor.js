// interceptor.js
// v1.0 - 10/08/2026 - versao inicial (filtro Voyager - nao funcionou)
// v1.1 - 10/08/2026 - modo diagnostico, captura tudo
// v2.0 - 10/08/2026 - coletor SDUI com pareamento POSICIONAL de autor/texto
// v2.5 - 10/08/2026 - CORRECAO CRITICA DA v2.4. Pegar "o slug mais raso"
//                     dava 100% de cobertura FALSA: o slug capturado era de
//                     quem reagiu ao post ou da empresa citada, nao do autor.
//                     Resultado: slug 'gabrielachaves2020' casado com o nome
//                     'Geraildo Santana', posts pessoais atribuidos a
//                     'picpay'/'cielo'. Dado errado e pior que dado ausente.
//                     Agora slug e nome sao pareados POR PROXIMIDADE DENTRO
//                     DA MESMA ROW: o link do autor fica ao lado do proprio
//                     rotulo de acessibilidade. Sem par confiavel, marca
//                     autor_incerto=true e nao entra em 'completo'.
// v2.4 - 10/08/2026 - AUTOR POR SLUG. O aria-label "Perfil Nº" so existe em
//                     alguns cards e e texto localizado (quebra se a conta
//                     mudar de idioma): fechava so 18 de 49 autores. Agora a
//                     ancora primaria e o slug em linkedin.com/in/<slug> ou
//                     /company/<slug> na profundidade minima da subarvore -
//                     estavel, unico e independente de idioma. O aria-label
//                     vira fonte secundaria, so para o nome de exibicao e o
//                     grau de conexao. IMPACTO NO PLANO: a tabela autores
//                     passa a ter o slug como chave primaria, nao o nome.
// v2.3 - 10/08/2026 - CORRECAO DO PARSER (3). A v2.2 fechou 13/32 e falhava
//                     de forma complementar (ora faltava autor, ora texto).
//                     Causa: cada post ocupa 8 a 24 rows do stream e eu usava
//                     so a MAIOR. Agora percorre ate 4 rows-candidatas por
//                     post, na ordem de tamanho, e para assim que tiver autor
//                     e texto. Prioridade preservada: texto da row maior
//                     vence, para nao deixar comentario sobrepor o corpo.
//                     Tambem descarta "texto" que e so URL (repost).
// v2.2 - 10/08/2026 - CORRECAO DO PARSER (2). A v2.1 fechou so 12 de 31
//                     posts. Duas causas, ambas corrigidas:
//                     a) TEXTO: a heuristica "row limpa vence" nao separava
//                        post de comentario. Agora usa PROFUNDIDADE na
//                        subarvore (BFS): o corpo do post fica na
//                        profundidade minima, comentario aparece mais fundo
//                        (medido: corpo prof=1, comentario prof=4). E o
//                        corpo vem QUEBRADO EM VARIOS NOS - agora todos os
//                        nos da profundidade minima sao concatenados na
//                        ordem, em vez de ficar so o maior.
//                     b) AUTOR: o aria-label tem variantes ("Usuario
//                        verificado", "Usuario Premium") que truncavam o
//                        nome ("Marcela R. Usuario verif"). Regex refeito.
// v2.1 - 10/08/2026 - CORRECAO DO PARSER. O pareamento posicional da v2.0
//                     errava dono de texto e perdia 8 de 29 autores. Agora:
//                     1) o payload RSC e quebrado em rows "id:conteudo";
//                     2) row-post = row com UM unico activityId que tenha
//                        contadores;
//                     3) autor e texto vem da SUBARVORE de referencias $L
//                        daquela row, nao da posicao no arquivo;
//                     4) texto de row contaminada por urn:li:comment perde
//                        para texto de row limpa.
//                     Validado contra payload real: 4/4 posts, autores
//                     corretamente atribuidos.

(() => {
  const ROTA_FEED = 'rsc-action/actions/pagination';
  const MODO_SONDA = location.pathname.includes('/feed/update/');

  const posts = new Map();       // activityId -> objeto
  const sondas = [];             // v2.0: payloads de pagina de post
  let paginas = 0;

  // =====================================================================
  // PARSER  (v2.1 - resolucao por grafo de rows RSC)
  // =====================================================================
  const RE_ROW    = /^([0-9a-f]+):([\s\S]*)$/;
  const RE_REF    = /\$L([0-9a-f]+)/g;
  const RE_ATIV   = /urn:li:activity:(\d+)/g;
  // v2.2: qualificadores em qualquer ordem e quantidade antes de "Perfil"
  const RE_AUTOR  = /"aria-label":"([^"]{2,70}?)\s+((?:(?:Usuário(?:\s+verificado)?|Premium)\s+)*)Perfil\s+([123])[ºo°]"/;
  const RE_TEXTO  = /"((?:[^"\\]|\\.){120,3000})"/g;
  const PALAVRAS  = /\b(que|para|com|uma|não|mais|você|isso|porque|como|quando)\b/gi;
  const RE_CONT   = /"\$case":"id","id":"([^"]{3,160})"\}\}(?:,"namespace":""\})?\},"value":\{"\$case":"intValue","intValue":(\d+)\}/g;

  function quebraRows(txt) {
    const rows = new Map();
    for (const linha of txt.split('\n')) {
      const m = RE_ROW.exec(linha);
      if (m) rows.set(m[1], m[2]);
    }
    return rows;
  }

  function contadoresGlobais(txt) {
    const tab = {};
    let m; RE_CONT.lastIndex = 0;
    while ((m = RE_CONT.exec(txt)) !== null) {
      const chave = m[1];
      if (chave.includes('urn:li:comment')) continue;
      const alvo = /urn:li:activity:(\d+)/.exec(chave);
      if (!alvo) continue;
      const campo = chave.slice(0, alvo.index).replace(/[-_]+$/, '');
      (tab[alvo[1]] = tab[alvo[1]] || {})[campo] = parseInt(m[2], 10);
    }
    return tab;
  }

  function idsDaRow(v) {
    const s = new Set(); let m; RE_ATIV.lastIndex = 0;
    while ((m = RE_ATIV.exec(v)) !== null) s.add(m[1]);
    return s;
  }

  // v2.3: TODAS as rows com um unico activityId, ordenadas por tamanho.
  function achaRowsPost(rows, cont) {
    const out = new Map();
    for (const [rid, v] of rows) {
      const ids = idsDaRow(v);
      if (ids.size !== 1) continue;
      const pid = [...ids][0];
      if (!cont[pid]) continue;
      if (!out.has(pid)) out.set(pid, []);
      out.get(pid).push({ rid, tam: v.length });
    }
    for (const lista of out.values()) {
      lista.sort((a, b) => b.tam - a.tam);
      lista.length = Math.min(lista.length, 4);   // teto de custo
    }
    return out;
  }

  const SO_URL = /^https?:\/\/\S+$/;
  // v2.4: ancora primaria de autor
  const RE_SLUG = /linkedin\.com\/(in|company)\/([A-Za-z0-9\-_%]{2,60})/g;

  // v2.2: BFS com profundidade. O corpo do post vive na profundidade
  // minima da subarvore; comentario e conteudo relacionado vivem mais fundo.
  function coletaDaSubarvore(rows, raiz, limite = 400) {
    const vistos = new Set();
    const fila = [{ r: raiz, prof: 0 }];
    const cands = [], slugs = [];
    let autor = null, ordem = 0;

    while (fila.length && vistos.size < limite) {
      const { r, prof } = fila.shift();          // FIFO = BFS
      if (vistos.has(r) || !rows.has(r)) continue;
      vistos.add(r);
      const v = rows.get(r);

      let m; RE_TEXTO.lastIndex = 0;
      while ((m = RE_TEXTO.exec(v)) !== null) {
        const s = m[1];
        if (s.includes('$L') || s.startsWith('_')) continue;
        if ((s.match(PALAVRAS) || []).length < 3) continue;
        cands.push({ prof, ordem: ordem++, s });
      }

      // v2.5: pareia slug com o rotulo do autor DENTRO da mesma row.
      // O link do autor fica adjacente ao proprio aria-label; slugs longe
      // dele sao de quem reagiu, de mencao no texto ou de empresa citada.
      const achados = [];
      let g; RE_SLUG.lastIndex = 0;
      while ((g = RE_SLUG.exec(v)) !== null) {
        achados.push({ i: g.index, tipo: g[1], slug: decodeURIComponent(g[2]) });
      }
      if (achados.length) {
        const rot = RE_AUTOR.exec(v);
        if (rot) {
          const alvo = rot.index;
          const perto = achados
            .map(s => ({ s, d: Math.abs(s.i - alvo) }))
            .sort((a, b) => a.d - b.d)[0];
          if (perto.d < 4000) {                      // adjacencia no mesmo card
            slugs.push({ prof, tipo: perto.s.tipo, slug: perto.s.slug,
                         nome: rot[1].trim(),
                         grau: rot[3] + 'o', certo: true });
          }
        } else {
          // sem rotulo: guarda como palpite, nunca como confirmado
          slugs.push({ prof, tipo: achados[0].tipo, slug: achados[0].slug,
                       certo: false });
        }
      }

      let r2; RE_REF.lastIndex = 0;
      while ((r2 = RE_REF.exec(v)) !== null) fila.push({ r: r2[1], prof: prof + 1 });
    }

    let texto = null;
    if (cands.length) {
      const minProf = Math.min(...cands.map(c => c.prof));
      texto = cands
        .filter(c => c.prof === minProf)         // so o nivel mais raso
        .sort((a, b) => a.ordem - b.ordem)       // ordem do documento
        .map(c => c.s)
        .join('\n\n')
        .replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    }
    // v2.5: par confirmado vence palpite; entre iguais, o mais raso
    if (slugs.length) {
      slugs.sort((a, b) => (b.certo - a.certo) || (a.prof - b.prof));
      const s0 = slugs[0];
      autor = { slug: s0.slug, tipo: s0.tipo, nome: s0.nome || null,
                grau: s0.grau || null, incerto: !s0.certo };
    }
    return { texto, autor, rowsVisitadas: vistos.size };
  }

  function parseFeed(txt) {
    const rows = quebraRows(txt);
    const cont = contadoresGlobais(txt);
    const rowsPost = achaRowsPost(rows, cont);
    let novos = 0;

    for (const [pid, cc] of Object.entries(cont)) {
      if (posts.has(pid)) continue;
      // v2.3: tenta as rows-candidatas em ordem de tamanho ate completar
      let texto = null, autor = null;
      for (const { rid } of (rowsPost.get(pid) || [])) {
        const r = coletaDaSubarvore(rows, rid);
        if (r.autor && (!autor || (autor.incerto && !r.autor.incerto))) autor = r.autor;  // v2.5
        if (!texto && r.texto && !SO_URL.test(r.texto)) texto = r.texto;
        if (autor && !autor.incerto && texto) break;   // v2.5
      }

      const tipos = {}; let reacoes = 0;
      for (const [k, v] of Object.entries(cc)) {
        if (k.startsWith('ReactionType_')) {
          const t = k.replace('ReactionType_', '');
          if (v > 0) tipos[t] = v;
          reacoes += v;
        }
      }

      posts.set(pid, {
        activity_id: pid,
        permalink: 'https://www.linkedin.com/feed/update/urn:li:activity:' + pid,
        autor, texto,
        reacoes, reacoes_tipos: tipos,
        comentarios: cc.commentCount || 0,
        reposts: cc.repostCount || 0,
        completo: !!(autor && autor.slug && !autor.incerto && texto),  // v2.5      // v2.1: flag de qualidade
        coletado_em: new Date().toISOString()
      });
      novos++;
    }
    return novos;
  }

  // =====================================================================
  // INTERCEPTACAO
  // =====================================================================
  function processa(url, texto) {
    if (!texto || texto.length < 5000) return;

    if (MODO_SONDA && url.includes('rsc-action')) {
      // v2.0: numa pagina de post, guarda tudo para descobrir o endpoint
      // de comentarios. Anotar o sduiid que aparecer aqui.
      sondas.push({ url, tamanho: texto.length, corpo: texto });
      render();
      return;
    }

    if (!url.includes(ROTA_FEED)) return;
    paginas++;
    parseFeed(texto);
    render();
  }

  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url) || '';
    if (url.includes('rsc-action')) {
      res.clone().text().then(t => processa(url, t)).catch(() => {});
    }
    return res;
  };

  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (metodo, url, ...resto) {
    this.addEventListener('load', () => {
      try { processa(String(url), this.responseText || ''); } catch (e) {}
    });
    return _open.call(this, metodo, url, ...resto);
  };

  // =====================================================================
  // PAINEL
  // =====================================================================
  let painel, resumo, lista;

  function criaPainel() {
    if (painel || !document.body) return;
    painel = document.createElement('div');
    Object.assign(painel.style, {
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 999999,
      width: '400px', maxHeight: '60vh', overflow: 'auto', background: '#111',
      color: '#eee', padding: '12px', borderRadius: '10px', fontSize: '11px',
      fontFamily: 'ui-monospace, monospace', lineHeight: '1.5',
      boxShadow: '0 4px 20px rgba(0,0,0,.5)'
    });

    resumo = document.createElement('div');
    resumo.style.cssText = 'font-weight:bold;margin-bottom:8px';

    const btnAuto = document.createElement('button');
    btnAuto.textContent = 'Carregar mais x15 (auto)';
    estiliza(btnAuto, '#374151');
    btnAuto.onclick = () => carregaMais(15);

    const btnBaixar = document.createElement('button');
    btnBaixar.textContent = 'Baixar JSON';
    estiliza(btnBaixar, '#0a66c2');
    btnBaixar.onclick = baixa;

    lista = document.createElement('div');
    painel.append(resumo, btnAuto, btnBaixar, lista);
    document.body.appendChild(painel);
    render();
  }

  function estiliza(b, cor) {
    Object.assign(b.style, {
      width: '100%', padding: '8px', marginBottom: '6px', border: 'none',
      borderRadius: '6px', background: cor, color: '#fff', fontWeight: '600',
      cursor: 'pointer', fontSize: '12px'
    });
  }

  function render() {
    if (!resumo) return;
    if (MODO_SONDA) {
      resumo.textContent = `SONDA: ${sondas.length} rsc-action capturados`;
      lista.innerHTML = sondas.map(s =>
        `<div style="border-bottom:1px solid #333;padding:4px 0">
           <span style="color:#4ade80">${(s.tamanho/1024)|0}KB</span><br>
           <span style="color:#fbbf24">${s.url.slice(0,140)}</span></div>`
      ).join('');
      return;
    }
    const ok = [...posts.values()].filter(p => p.completo).length;
    resumo.textContent = `${posts.size} posts | ${ok} completos | ${paginas} pgs`;
    const arr = [...posts.values()]
      .sort((a, b) => b.reacoes - a.reacoes).slice(0, 12);
    lista.innerHTML = arr.map(p => {
      const tipos = Object.entries(p.reacoes_tipos)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k.slice(0, 4)}:${v}`).join(' ');
      return `<div style="border-bottom:1px solid #333;padding:4px 0">
        <span style="color:#4ade80">${p.reacoes}r ${p.comentarios}c</span>
        <span style="color:#93c5fd">${p.autor ? p.autor.nome : '?'}</span><br>
        <span style="color:#888">${tipos}</span><br>
        <span style="color:#ddd">${(p.texto || '(sem texto)').slice(0, 90)}</span>
      </div>`;
    }).join('');
  }

  // =====================================================================
  // PAGINACAO - MutationObserver, nao setTimeout fixo
  // =====================================================================
  function achaBotaoMais() {
    return [...document.querySelectorAll('button')]
      .find(b => /carregar mais|show more|ver mais/i.test(b.textContent || ''));
  }

  async function carregaMais(n) {
    for (let i = 0; i < n; i++) {
      const btn = achaBotaoMais();
      if (!btn) break;
      const antes = posts.size;
      btn.click();
      await esperaCrescer(antes, 8000);
      await pausa(800 + Math.random() * 900);       // ritmo humano
    }
  }

  function esperaCrescer(antes, timeout) {
    return new Promise(resolve => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (posts.size > antes || Date.now() - t0 > timeout) {
          clearInterval(iv); resolve();
        }
      }, 200);
    });
  }

  const pausa = ms => new Promise(r => setTimeout(r, ms));

  // =====================================================================
  // DOWNLOAD
  // =====================================================================
  function baixa() {
    const pacote = MODO_SONDA
      ? { tipo: 'sonda_comentarios', capturado_em: new Date().toISOString(),
          endpoints: sondas.map(s => ({ url: s.url, tamanho: s.tamanho })),
          amostra: sondas.sort((a, b) => b.tamanho - a.tamanho)[0]?.corpo || null }
      : { tipo: 'feed', capturado_em: new Date().toISOString(),
          paginas, total: posts.size, posts: [...posts.values()] };

    const blob = new Blob([JSON.stringify(pacote, null, 2)],
                          { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = MODO_SONDA ? 'sonda-comentarios.json' : 'feed-coletado.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (document.body) criaPainel();
  else document.addEventListener('DOMContentLoaded', criaPainel);
})();
