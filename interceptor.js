// interceptor.js
// v2.7 - 26/08/2026 - CALIBRACAO CONTRA PAYLOAD REAL (34 posts, 11 paginas).
//                     A v2.6 acertou o corpo longo (media de 1069 chars,
//                     maior com 3371) mas o feed real mostrou tres coisas
//                     que o payload sintetico nao tinha:
//                     a) CHROME DE UI DENTRO DO CORPO. Strings da interface
//                        entravam como paragrafo: ids de tela SDUI
//                        (com.linkedin.sdui...#hash), o erro "Nao foi
//                        possivel ocultar a publicacao" (19 de 23 posts) e
//                        o headline do proprio usuario logado, que vem da
//                        navbar e apareceu em 21 posts. Agora ha tres
//                        filtros: id de tela, headline (2+ ' | ' sem
//                        pontuacao de frase) e - o que resolve o resto sem
//                        depender de idioma - FREQUENCIA: run identica que
//                        aparece em 3+ posts distintos e interface, nao
//                        texto de post. O tally e global e os textos sao
//                        recalculados a cada pagina.
//                     b) COMENTARIO ERA SO LIXO. Os 28 "comentarios" da
//                        v2.6 eram placeholder, id de tela e rotulo de
//                        acessibilidade - zero corpo real. O payload de
//                        feed NAO carrega o corpo dos comentarios, so o
//                        metadado. Entao: filtro duro (nada de rotulo
//                        duplicado como texto, nada de chrome) e, no lugar
//                        do que nao existe, colhe o que existe - o NOME de
//                        quem comentou, que vem no rotulo "comentario de
//                        X". Corpo de comentario exige a pagina do post.
//                     c) CORPO NUNCA MAIS VEM DE ROW DE COMENTARIO. Um
//                        post (guta-tolmasquim) recebeu como 'texto' a
//                        resposta de outra pessoa, porque o corpo dele nao
//                        estava no payload e a v2.6 caia para a row
//                        contaminada. Sem corpo limpo, texto fica null.
//                     Alem disso: nucleo fraco para post curto (legenda de
//                     imagem nao chegava a 120 chars e virava texto null em
//                     11 de 34 posts) e autor.diag + botao de diagnostico,
//                     porque as duas ancoras novas da v2.6 fecharam ZERO
//                     casos no payload real e sem a row crua nao da para
//                     saber por que.
// v2.6 - 26/08/2026 - SEIS CORRECOES. Em ordem de impacto no produto:
//                     1) TEXTO COMPLETO. A v2.5 so concatenava os nos da
//                        profundidade MINIMA e exigia run de 120+ chars com
//                        3+ palavras funcionais. Post de varios paragrafos
//                        parava no fim do primeiro: o miolo e a conclusao -
//                        onde mora a tese - ficavam de fora. Agora a janela
//                        e [minProf, minProf+1] (comentario vive em prof~4,
//                        entao continua fora), runs curtas (25+ chars) sao
//                        aceitas quando acompanham um nucleo forte, o teto
//                        por run subiu de 3000 para 8000 e ha deduplicacao
//                        por continencia para nao repetir paragrafo.
//                     2) COMENTARIOS. Passam a ser coletados das rows
//                        contaminadas por urn:li:comment, pareados com o
//                        post pelo activityId de dentro do proprio urn, com
//                        autor por proximidade. Sem isso o Gemini sugeria
//                        angulo que ja estava na segunda resposta.
//                     3) AUTOR. Cobertura era ~47%: o par so fechava com o
//                        aria-label localizado "Perfil Nº". Agora ha duas
//                        ancoras secundarias, ambas independentes de idioma:
//                        (a) rotulo generico "aria-label" adjacente ao slug;
//                        (b) slug DOMINANTE da row rasa (foto + nome +
//                        headline apontam para o mesmo perfil) quando ele e
//                        tambem o primeiro da row. Slug de quem reagiu ou de
//                        empresa citada nao satisfaz nenhuma das duas. Fica
//                        registrado em autor.confianca/autor.fonte.
//                     4) SLUG COM ACENTO. A classe [A-Za-z0-9-_%] truncava
//                        em caractere nao-ASCII: 'prime-class-solu'. Agora
//                        aceita UTF-8 literal e escape \uXXXX, e normaliza.
//                     5) PATROCINADO. Marcadores de anuncio na subarvore do
//                        post viram patrocinado:true na origem, em vez de
//                        entrar no pipeline como organico.
//                     6) VERSAO. Uma unica constante VERSAO, exposta em
//                        window.__radar.versao, no painel e no JSON baixado.
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
// v2.0 - 10/08/2026 - coletor SDUI com pareamento POSICIONAL de autor/texto
// v1.1 - 10/08/2026 - modo diagnostico, captura tudo
// v1.0 - 10/08/2026 - versao inicial (filtro Voyager - nao funcionou)

(() => {
  // v2.6 (6): fonte unica da versao. Painel, window.__radar e o JSON
  // baixado leem daqui - nao existe mais numero solto no arquivo.
  const VERSAO = '2.7';

  const ROTA_FEED = 'rsc-action/actions/pagination';
  const MODO_SONDA = location.pathname.includes('/feed/update/');

  const posts = new Map();       // activityId -> objeto
  const sondas = [];             // v2.0: payloads de pagina de post
  let paginas = 0;

  // v2.7: estado do filtro por frequencia. Uma run identica que aparece em
  // posts DIFERENTES e interface (id de tela, erro de UI, headline da
  // navbar), nao corpo de post. Medido no feed real: 5 strings apareciam
  // em 19 a 21 dos 23 posts com texto. O tally e global e persiste entre
  // paginas, por isso os textos sao recalculados a cada pagina nova.
  const CHROME_MIN = 3;
  const tallyChrome = new Map();   // texto -> Set(pid)
  const candsPorPost = new Map();  // pid -> candidatos de texto
  const amostraRow = new Map();    // pid -> row crua (so p/ diagnostico)

  function ehChrome(t) {
    const s = tallyChrome.get(t);
    return !!s && s.size >= CHROME_MIN;
  }

  // =====================================================================
  // PARSER  (v2.1 - resolucao por grafo de rows RSC)
  // =====================================================================
  const RE_ROW    = /^([0-9a-f]+):([\s\S]*)$/;
  const RE_REF    = /\$L([0-9a-f]+)/g;
  const RE_ATIV   = /urn:li:activity:(\d+)/g;
  // v2.2: qualificadores em qualquer ordem e quantidade antes de "Perfil"
  const RE_AUTOR  = /"aria-label":"([^"]{2,70}?)\s+((?:(?:Usuário(?:\s+verificado)?|Premium)\s+)*)Perfil\s+([123])[ºo°]"/;
  // v2.6 (3): rotulo generico, sem depender do idioma da conta
  const RE_ROTULO = /"aria-label":"([^"]{2,70})"/g;
  const RE_NOME_TXT = /"(?:text|name|title)":"([^"\\]{2,70})"/g;
  // v2.6 (1): piso de 40 (era 120) e teto de 8000 (era 3000). O piso baixo
  // so entra no corpo se houver nucleo forte na mesma janela - ver
  // montaTexto(). O teto alto evita cortar post longo no meio.
  const RE_TEXTO  = /"((?:[^"\\]|\\.){40,8000})"/g;
  const PALAVRAS  = /\b(que|para|com|uma|não|nao|mais|você|voce|isso|porque|como|quando|mas|também|tambem|sobre|sem|pelo|pela|meu|minha|nosso|seu)\b/gi;
  const RE_CONT   = /"\$case":"id","id":"([^"]{3,160})"\}\}(?:,"namespace":""\})?\},"value":\{"\$case":"intValue","intValue":(\d+)\}/g;

  // v2.6 (2): o urn de comentario carrega o activityId do post pai.
  // Formatos vistos: urn:li:comment:(urn:li:activity:123,456) e
  // urn:li:comment:(urn:li:ugcPost:123,456).
  const RE_COMENT = /urn:li:comment:\((?:urn:li:(?:activity|ugcPost|share):)?(\d+)\s*,\s*(\d+)\)/g;

  // v2.7: nome de quem comentou. O corpo do comentario nao vem no payload
  // de feed, mas o rotulo de acessibilidade do menu do comentario vem, e
  // ele carrega o nome. Cobre pt e en; sem match, o campo fica vazio.
  const RE_COMENTARISTA = /(?:coment[áa]rio de|comment (?:by|from))\s+([^."]{2,60})\s*\.?"/i;

  // v2.6 (5): marcadores de anuncio. Lista fechada de propositos, para nao
  // flagar post organico que apenas cita a palavra "patrocinado".
  const RE_PATROC = /(urn:li:sponsoredCreative|urn:li:sponsoredAccount|urn:li:sponsoredCampaign|"sponsoredCreative|"isSponsored":\s*true|"promoted":\s*true|"adUrn"|"sponsoredLabel"|"(?:Patrocinado|Patrocinada|Promovido|Promovida|Promoted|Sponsored|Anúncio|Publicidade)")/i;

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
      lista.length = Math.min(lista.length, 6);   // v2.6: teto 4 -> 6
    }
    return out;
  }

  const SO_URL = /^https?:\/\/\S+$/;
  // v2.4: ancora primaria de autor
  // v2.6 (4): a classe antiga [A-Za-z0-9-_%] parava no primeiro caractere
  // nao-ASCII e devolvia 'prime-class-solu'. Agora aceita UTF-8 literal e
  // escape \uXXXX; a normalizacao decodifica e limpa a borda.
  const RE_SLUG = /linkedin\.com\/(in|company)\/((?:[A-Za-z0-9\-_%.]|\\u[0-9a-fA-F]{4}|[^\x00-\x7F"\\/?#\s])+)/g;

  function normalizaSlug(bruto) {
    let s = String(bruto)
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\+$/, '');
    try { s = decodeURIComponent(s); } catch (e) { /* slug com % solto */ }
    // remove pontuacao de borda que veio do JSON, preserva letra acentuada
    return s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  }

  function desescapa(s) {
    return s
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/')
      .replace(/\\\\/g, '\\');
  }

  function palavrasFuncionais(s) {
    PALAVRAS.lastIndex = 0;
    return (s.match(PALAVRAS) || []).length;
  }

  // v2.6 (1): descarta run que e chave/id/serializacao, nao prosa.
  function pareceLixo(s) {
    if (s.includes('$L') || s.startsWith('_')) return true;
    if (SO_URL.test(s)) return true;
    if (/^[A-Za-z0-9+/=]{40,}$/.test(s)) return true;              // base64/id
    if (/urn:li:/.test(s) && palavrasFuncionais(s) < 3) return true;
    if (/^[\w.-]+$/.test(s)) return true;                          // token unico
    // v2.7: id de tela SDUI - 'com.linkedin.sdui.flagshipnav.home.Home#0'
    if (/com\.linkedin\./.test(s)) return true;
    if (/^[\w.]+#[0-9a-f]+$/i.test(s)) return true;
    return false;
  }

  // v2.7: headline de perfil ('Cargo | Empresa | Especialidade'). Entrava
  // no corpo como paragrafo. Exige 2+ separadores e nenhuma pontuacao de
  // fim de frase, para nao pegar post que usa barra vertical no meio.
  function pareceHeadline(s) {
    return (s.match(/\s\|\s/g) || []).length >= 2 &&
           s.length <= 220 && !/[.!?]\s/.test(s);
  }

  // v2.7: um unico ponto de decisao sobre o que nao e prosa de post.
  function descartavel(t) {
    return !t || pareceLixo(t) || pareceHeadline(t) || ehChrome(t);
  }

  // v2.6 (1): monta o corpo inteiro do post.
  // Regra: o NUCLEO sao as runs longas com prosa; a janela de profundidade
  // aceita e [minProf, minProf+1] - medido: corpo em prof 1, comentario em
  // prof 4, entao o +1 pega a continuacao do corpo sem deixar comentario
  // entrar. Dentro da janela, runs curtas (paragrafo de uma linha, pergunta
  // final, assinatura) tambem entram, desde que venham de row nao
  // contaminada por urn:li:comment.
  function montaTexto(cands) {
    // v2.7: corpo NUNCA vem de row contaminada por urn:li:comment. No feed
    // real um post ficou com a resposta de outra pessoa como 'texto',
    // porque o corpo dele nao estava no payload e a v2.6 caia para a row
    // de comentario. Sem corpo limpo, texto fica null - dado ausente.
    const limpos = cands.filter(c => !c.comentario && !descartavel(c.t));
    if (!limpos.length) return null;

    // nucleo forte: run longa com prosa. Se nao houver, nucleo FRACO -
    // 40+ chars com 2+ palavras funcionais. E o caso da legenda de foto e
    // do post de uma linha, que na v2.6 virava texto null (11 de 34).
    let nucleo = limpos.filter(c => c.forte);
    let fonte = 'nucleo';
    if (!nucleo.length) {
      nucleo = limpos.filter(c => c.t.length >= 40 && palavrasFuncionais(c.t) >= 2);
      fonte = 'nucleo-fraco';
    }
    if (!nucleo.length) return null;
    const minProf = Math.min(...nucleo.map(c => c.prof));

    const escolhidos = limpos
      .filter(c => c.prof >= minProf && c.prof <= minProf + 1)
      .filter(c => c.forte || (c.t.length >= 25 && palavrasFuncionais(c.t) >= 1))
      .sort((a, b) => (a.prof - b.prof) || (a.ordem - b.ordem));

    // deduplicacao por continencia: paragrafo repetido em outra row, ou run
    // curta que ja esta dentro de uma run longa, nao entra duas vezes.
    const partes = [];
    for (const c of escolhidos) {
      const t = c.t;
      if (!t) continue;
      let engole = false;
      for (let i = 0; i < partes.length; i++) {
        if (partes[i] === t || partes[i].includes(t)) { engole = true; break; }
        if (t.includes(partes[i])) { partes[i] = t; engole = true; break; }
      }
      if (!engole) partes.push(t);
    }
    const texto = partes.join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s*…\s*(ver mais|see more|mais)\s*$/i, '')
      .trim();
    return texto ? { texto, fonte } : null;
  }

  // v2.6 (3): limpa qualificador que gruda no nome de exibicao.
  function limpaNome(n) {
    return String(n)
      .replace(/\s*(Usuário(\s+verificado)?|Premium|Verified|Influencer)\s*/gi, ' ')
      .replace(/\s*•?\s*(Perfil\s*)?[123][ºo°]\s*(grau)?\s*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || null;
  }

  // v2.6 (3): ancoras secundarias de autor, todas independentes de idioma.
  // Ordem de confianca: alta (aria-label "Perfil Nº" adjacente ao slug) >
  // media (rotulo generico adjacente, ou slug dominante que tambem e o
  // primeiro da row) > baixa (palpite, entra como incerto).
  function resolveAutorDaRow(v, prof) {
    const achados = [];
    let g; RE_SLUG.lastIndex = 0;
    while ((g = RE_SLUG.exec(v)) !== null) {
      const slug = normalizaSlug(g[2]);
      if (slug.length >= 2) achados.push({ i: g.index, tipo: g[1], slug });
    }
    if (!achados.length) return null;

    // (a) ancora primaria: rotulo com grau de conexao
    const rot = RE_AUTOR.exec(v);
    if (rot) {
      const alvo = rot.index;
      const perto = achados
        .map(s => ({ s, d: Math.abs(s.i - alvo) }))
        .sort((a, b) => a.d - b.d)[0];
      if (perto.d < 4000) {                        // adjacencia no mesmo card
        return { prof, tipo: perto.s.tipo, slug: perto.s.slug,
                 nome: limpaNome(rot[1]), grau: rot[3] + 'o',
                 certo: true, confianca: 'alta', fonte: 'aria-label-grau' };
      }
    }

    // as ancoras secundarias so valem no card do autor, que e raso.
    // Mais fundo o que aparece e reacao, mencao e empresa citada.
    // v2.7: no feed real estas duas fecharam ZERO casos - 14 posts caíram
    // para 'baixa' e nao da para saber por que sem a row crua. Por isso a
    // profundidade subiu para <=2 e cada resultado carrega um diag com os
    // numeros que decidiram, exportado no botao de diagnostico.
    const primeiro = achados[0];
    const contagem = achados.reduce((acc, a) => {
      acc[a.slug] = (acc[a.slug] || 0) + 1; return acc;
    }, {});
    const dominante = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0];
    const diag = { prof, slugs: achados.length,
                   distintos: Object.keys(contagem).length,
                   dominante: dominante[0], ocorrencias: dominante[1],
                   rotulo_grau: !!rot, dist_rotulo: null };

    if (prof <= 2) {

      // (b) rotulo generico colado no primeiro slug (foto do autor)
      let nomeProx = null, melhor = Infinity;
      let r; RE_ROTULO.lastIndex = 0;
      while ((r = RE_ROTULO.exec(v)) !== null) {
        const d = primeiro.i - r.index;
        if (d >= 0 && d < melhor && d < 1500) { melhor = d; nomeProx = r[1]; }
      }
      diag.dist_rotulo = melhor === Infinity ? null : melhor;
      // (c) slug dominante: foto + nome + headline apontam para o mesmo
      // perfil. Quem so reagiu aparece uma vez so.
      const ehDominante = dominante && dominante[0] === primeiro.slug &&
                          dominante[1] >= 2;

      if (nomeProx || ehDominante) {
        let nome = limpaNome(nomeProx || '');
        if (!nome) {                                // ultimo recurso: campo texto
          let t, alvo = Infinity; RE_NOME_TXT.lastIndex = 0;
          while ((t = RE_NOME_TXT.exec(v)) !== null) {
            const d = primeiro.i - t.index;
            if (d >= 0 && d < alvo && d < 1200) { alvo = d; nome = limpaNome(t[1]); }
          }
        }
        return { prof, tipo: primeiro.tipo, slug: primeiro.slug, nome,
                 grau: null, certo: true, confianca: 'media', diag,
                 fonte: nomeProx ? 'rotulo-adjacente' : 'slug-dominante' };
      }
    }

    // (d) sem ancora: palpite, nunca confirmado
    return { prof, tipo: achados[0].tipo, slug: achados[0].slug, nome: null,
             grau: null, certo: false, confianca: 'baixa',
             fonte: 'primeiro-slug', diag };
  }

  const RANK = { alta: 0, media: 1, baixa: 2 };

  // v2.2: BFS com profundidade. O corpo do post vive na profundidade
  // minima da subarvore; comentario e conteudo relacionado vivem mais fundo.
  function coletaDaSubarvore(rows, raiz, limite = 1200) {   // v2.6: 400 -> 1200
    const vistos = new Set();
    const fila = [{ r: raiz, prof: 0 }];
    const cands = [], autores = [], comentaristas = [];
    let autor = null, ordem = 0, patrocinado = false;

    while (fila.length && vistos.size < limite) {
      const { r, prof } = fila.shift();          // FIFO = BFS
      if (vistos.has(r) || !rows.has(r)) continue;
      vistos.add(r);
      const v = rows.get(r);
      const ehComentario = v.includes('urn:li:comment');

      // v2.6 (5): marcador de anuncio na subarvore do proprio post
      if (!patrocinado && RE_PATROC.test(v)) patrocinado = true;

      let m; RE_TEXTO.lastIndex = 0;
      while ((m = RE_TEXTO.exec(v)) !== null) {
        if (pareceLixo(m[1])) continue;
        // v2.7: desescapa na coleta, para tally e filtro verem a mesma
        // string que vai para o texto final.
        const t = desescapa(m[1]).trim();
        if (!t) continue;
        const forte = t.length >= 120 && palavrasFuncionais(t) >= 3;
        if (!forte && palavrasFuncionais(t) < 1) continue;
        cands.push({ prof, ordem: ordem++, t, forte, comentario: ehComentario });
      }

      // v2.7: nome de quem comentou, unico dado de comentario que o feed
      // realmente entrega.
      if (ehComentario) {
        let cm; const re = new RegExp(RE_COMENTARISTA.source, 'gi');
        while ((cm = re.exec(v)) !== null) {
          const nome = limpaNome(cm[1]);
          if (nome && !comentaristas.includes(nome)) comentaristas.push(nome);
        }
      }

      // v2.5: pareia slug com o rotulo do autor DENTRO da mesma row.
      // v2.6 (3): com duas ancoras secundarias independentes de idioma.
      if (!ehComentario) {
        const a = resolveAutorDaRow(v, prof);
        if (a) autores.push(a);
      }

      let r2; RE_REF.lastIndex = 0;
      while ((r2 = RE_REF.exec(v)) !== null) fila.push({ r: r2[1], prof: prof + 1 });
    }

    // v2.7: o texto nao e montado aqui. O filtro por frequencia so fecha
    // depois que todos os posts da pagina foram varridos, entao a
    // subarvore devolve os candidatos crus e parseFeed monta no fim.
    if (autores.length) {
      autores.sort((a, b) => (RANK[a.confianca] - RANK[b.confianca]) || (a.prof - b.prof));
      const s0 = autores[0];
      autor = { slug: s0.slug, tipo: s0.tipo, nome: s0.nome || null,
                grau: s0.grau || null, incerto: !s0.certo,
                confianca: s0.confianca, fonte: s0.fonte, diag: s0.diag || null };
    }
    return { cands, autor, patrocinado, comentaristas, rowsVisitadas: vistos.size };
  }

  // =====================================================================
  // COMENTARIOS  (v2.6 - ponto 2)
  // =====================================================================
  // As rows de comentario carregam o activityId do post pai dentro do
  // proprio urn:li:comment:(...,...), entao o pareamento nao depende de
  // posicao nem da subarvore do post. Dentro da row, cada texto e casado
  // com o slug/rotulo que vem imediatamente antes dele.
  const TETO_COMENT = 20;

  function comentariosDaRow(v) {
    const marcas = [];
    let g; RE_SLUG.lastIndex = 0;
    while ((g = RE_SLUG.exec(v)) !== null) {
      const slug = normalizaSlug(g[2]);
      if (slug.length >= 2) marcas.push({ i: g.index, slug });
    }
    // v2.7: guarda os rotulos para poder DESCARTAR texto que e o proprio
    // rotulo. Era dai que vinha "Ver mais opcoes para o comentario de X."
    // entrando como se fosse o comentario.
    const rotulos = [];
    let r; RE_ROTULO.lastIndex = 0;
    while ((r = RE_ROTULO.exec(v)) !== null) {
      rotulos.push({ i: r.index, nome: r[1], texto: desescapa(r[1]).trim() });
    }
    const setRotulos = new Set(rotulos.map(x => x.texto));

    const antesDe = (lista, pos, janela) => {
      let melhor = null, dist = janela;
      for (const item of lista) {
        const d = pos - item.i;
        if (d >= 0 && d < dist) { dist = d; melhor = item; }
      }
      return melhor;
    };

    const out = [];
    let m; RE_TEXTO.lastIndex = 0;
    while ((m = RE_TEXTO.exec(v)) !== null) {
      if (pareceLixo(m[1])) continue;
      const t = desescapa(m[1]).trim();
      // v2.7: as tres portas que sobraram vazias no feed real - e por isso
      // que 28 "comentarios" da v2.6 eram placeholder, id de tela e rotulo.
      if (setRotulos.has(t)) continue;             // rotulo de acessibilidade
      if (descartavel(t)) continue;                // chrome / headline / id
      if (t.length < 25 || palavrasFuncionais(t) < 2) continue;
      if (/^[^a-zA-ZÀ-ÿ]*$/.test(t)) continue;
      const dono = antesDe(marcas, m.index, 3000);
      const rot  = antesDe(rotulos, m.index, 3000);
      out.push({
        autor_slug: dono ? dono.slug : null,
        autor_nome: rot ? limpaNome(rot.nome) : null,
        texto: t
      });
    }
    return out;
  }

  function coletaComentarios(rows) {
    const porPost = new Map();
    for (const [, v] of rows) {
      if (!v.includes('urn:li:comment')) continue;
      const alvos = new Set();
      let c; RE_COMENT.lastIndex = 0;
      while ((c = RE_COMENT.exec(v)) !== null) alvos.add(c[1]);
      if (!alvos.size) continue;
      const itens = comentariosDaRow(v);
      if (!itens.length) continue;
      for (const pid of alvos) {
        if (!porPost.has(pid)) porPost.set(pid, []);
        porPost.get(pid).push(...itens);
      }
    }
    // dedup por (autor|texto) e teto por post
    for (const [pid, lista] of porPost) {
      const vistos = new Set(), limpos = [];
      for (const it of lista) {
        const k = (it.autor_slug || '?') + '|' + it.texto;
        if (vistos.has(k)) continue;
        vistos.add(k);
        limpos.push(it);
        if (limpos.length >= TETO_COMENT) break;
      }
      porPost.set(pid, limpos);
    }
    return porPost;
  }

  // v2.7: o filtro por frequencia so pode decidir depois que a pagina
  // inteira foi varrida - e uma run vira chrome ao aparecer no 3o post,
  // que pode ser de uma pagina posterior. Por isso os candidatos ficam
  // guardados e TODOS os textos sao remontados a cada pagina nova.
  function registraTally(pid, cands) {
    for (const c of cands) {
      if (!tallyChrome.has(c.t)) tallyChrome.set(c.t, new Set());
      tallyChrome.get(c.t).add(pid);
    }
  }

  function recalculaTextos() {
    for (const [pid, post] of posts) {
      const r = montaTexto(candsPorPost.get(pid) || []);
      post.texto = r ? r.texto : null;
      post.texto_fonte = r ? r.fonte : null;
      post.texto_tamanho = r ? r.texto.length : 0;
      post.completo = !!(post.autor && post.autor.slug &&
                         !post.autor.incerto && post.texto);
      post.comentarios_coletados = (post._coment || []).filter(c =>
        !post.texto || (!post.texto.includes(c.texto) && !c.texto.includes(post.texto)));
    }
  }

  function parseFeed(txt) {
    const rows = quebraRows(txt);
    const cont = contadoresGlobais(txt);
    const rowsPost = achaRowsPost(rows, cont);
    const comentarios = coletaComentarios(rows);   // v2.6 (2)
    let novos = 0;

    for (const [pid, cc] of Object.entries(cont)) {
      if (posts.has(pid)) continue;
      // v2.3: tenta as rows-candidatas em ordem de tamanho ate completar
      let autor = null, patrocinado = false;
      let cands = [], comentaristas = [];
      const candidatas = rowsPost.get(pid) || [];
      for (const { rid } of candidatas) {
        const r = coletaDaSubarvore(rows, rid);
        if (r.patrocinado) patrocinado = true;
        // v2.6 (3): troca por autor de confianca estritamente melhor
        if (r.autor && (!autor || RANK[r.autor.confianca] < RANK[autor.confianca])) {
          autor = r.autor;
        }
        cands = cands.concat(r.cands);
        for (const n of r.comentaristas) {
          if (!comentaristas.includes(n)) comentaristas.push(n);
        }
        if (autor && autor.confianca === 'alta' && cands.some(c => c.forte)) break;
      }

      const tipos = {}; let reacoes = 0;
      for (const [k, v] of Object.entries(cc)) {
        if (k.startsWith('ReactionType_')) {
          const t = k.replace('ReactionType_', '');
          if (v > 0) tipos[t] = v;
          reacoes += v;
        }
      }

      candsPorPost.set(pid, cands);
      registraTally(pid, cands);
      // v2.7: row crua guardada so para os dois casos que ainda falham -
      // autor incerto e post sem texto. E o que o botao de diagnostico
      // exporta; nao entra no JSON normal.
      if (candidatas[0] && (!autor || autor.incerto)) {
        amostraRow.set(pid, (rows.get(candidatas[0].rid) || '').slice(0, 6000));
      }

      const post = {
        activity_id: pid,
        permalink: 'https://www.linkedin.com/feed/update/urn:li:activity:' + pid,
        autor, texto: null,
        texto_tamanho: 0,
        texto_fonte: null,                                 // v2.7
        patrocinado,                                       // v2.6 (5)
        reacoes, reacoes_tipos: tipos,
        comentarios: cc.commentCount || 0,
        comentarios_coletados: [],                         // v2.6 (2)
        comentaristas,                                     // v2.7
        reposts: cc.repostCount || 0,
        completo: false,                                   // v2.5
        coletado_em: new Date().toISOString(),
        versao_coletor: VERSAO                             // v2.6 (6)
      };
      // guardado fora da serializacao: fonte para o recalculo por pagina
      Object.defineProperty(post, '_coment', {
        value: comentarios.get(pid) || [], enumerable: false, writable: true });
      posts.set(pid, post);
      novos++;
    }

    // um comentario pode chegar numa pagina posterior a do post
    for (const [pid, lista] of comentarios) {
      const p = posts.get(pid);
      if (p && lista.length > p._coment.length) p._coment = lista;
    }

    recalculaTextos();
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
      // v2.6 (2): na pagina do post a thread vem completa - aproveita.
      try { parseFeed(texto); } catch (e) {}
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

    // v2.7: exporta a row crua dos posts que ainda falham (autor incerto),
    // que e o que falta para calibrar as ancoras secundarias.
    const btnDiag = document.createElement('button');
    btnDiag.textContent = 'Baixar diagnóstico (autor incerto)';
    estiliza(btnDiag, '#7c3aed');
    btnDiag.onclick = baixaDiag;

    lista = document.createElement('div');
    painel.append(resumo, btnAuto, btnBaixar, btnDiag, lista);
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

  function estatisticas() {
    const arr = [...posts.values()];
    return {
      versao: VERSAO,
      total: arr.length,
      completos: arr.filter(p => p.completo).length,
      com_autor: arr.filter(p => p.autor && p.autor.slug).length,
      autor_alta: arr.filter(p => p.autor && p.autor.confianca === 'alta').length,
      autor_media: arr.filter(p => p.autor && p.autor.confianca === 'media').length,
      autor_incerto: arr.filter(p => p.autor && p.autor.incerto).length,
      com_texto: arr.filter(p => p.texto).length,
      texto_nucleo_fraco: arr.filter(p => p.texto_fonte === 'nucleo-fraco').length,
      texto_medio: arr.length
        ? Math.round(arr.reduce((s, p) => s + p.texto_tamanho, 0) / arr.length) : 0,
      chrome_filtrado: [...tallyChrome.values()].filter(x => x.size >= CHROME_MIN).length,
      comentaristas: arr.reduce((s, p) => s + p.comentaristas.length, 0),
      com_comentarios: arr.filter(p => p.comentarios_coletados.length).length,
      comentarios_coletados: arr.reduce((s, p) => s + p.comentarios_coletados.length, 0),
      patrocinados: arr.filter(p => p.patrocinado).length,
      paginas
    };
  }

  function render() {
    if (!resumo) return;
    if (MODO_SONDA) {
      resumo.textContent = `v${VERSAO} SONDA: ${sondas.length} rsc-action | ${posts.size} posts`;
      lista.innerHTML = sondas.map(s =>
        `<div style="border-bottom:1px solid #333;padding:4px 0">
           <span style="color:#4ade80">${(s.tamanho/1024)|0}KB</span><br>
           <span style="color:#fbbf24">${s.url.slice(0,140)}</span></div>`
      ).join('');
      return;
    }
    const e = estatisticas();
    resumo.textContent =
      `v${VERSAO} | ${e.total} posts | ${e.completos} completos | ` +
      `${e.com_texto} c/texto | ${e.comentaristas} comentaristas | ` +
      `${e.patrocinados} ads | ${e.chrome_filtrado} chrome | ${e.paginas} pgs`;
    const arr = [...posts.values()]
      .sort((a, b) => b.reacoes - a.reacoes).slice(0, 12);
    lista.innerHTML = arr.map(p => {
      const tipos = Object.entries(p.reacoes_tipos)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k.slice(0, 4)}:${v}`).join(' ');
      const marca = p.patrocinado ? ' <span style="color:#f87171">[ads]</span>' : '';
      const conf = p.autor ? ` <span style="color:#888">(${p.autor.confianca})</span>` : '';
      return `<div style="border-bottom:1px solid #333;padding:4px 0">
        <span style="color:#4ade80">${p.reacoes}r ${p.comentarios}c/${p.comentarios_coletados.length}</span>
        <span style="color:#93c5fd">${p.autor ? (p.autor.nome || p.autor.slug) : '?'}</span>${conf}${marca}<br>
        <span style="color:#888">${tipos}</span><br>
        <span style="color:#ddd">${(p.texto || '(sem texto)').slice(0, 90)}</span>
        <span style="color:#666">${p.texto_tamanho ? ' [' + p.texto_tamanho + ' chars]' : ''}</span>
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
  function pacoteAtual() {
    return MODO_SONDA
      ? { tipo: 'sonda_comentarios', versao: VERSAO,
          capturado_em: new Date().toISOString(),
          endpoints: sondas.map(s => ({ url: s.url, tamanho: s.tamanho })),
          posts: [...posts.values()],
          amostra: sondas.slice().sort((a, b) => b.tamanho - a.tamanho)[0]?.corpo || null }
      : { tipo: 'feed', versao: VERSAO, capturado_em: new Date().toISOString(),
          paginas, total: posts.size, estatisticas: estatisticas(),
          posts: [...posts.values()] };
  }

  // v2.7: pacote separado, para nao inflar o JSON de producao.
  function pacoteDiag() {
    const alvos = [...posts.values()].filter(p => !p.autor || p.autor.incerto);
    return {
      tipo: 'diagnostico_autor', versao: VERSAO,
      capturado_em: new Date().toISOString(),
      estatisticas: estatisticas(),
      chrome: [...tallyChrome.entries()]
        .filter(([, v]) => v.size >= CHROME_MIN)
        .map(([t, v]) => ({ ocorrencias: v.size, texto: t.slice(0, 160) })),
      casos: alvos.map(p => ({
        activity_id: p.activity_id,
        permalink: p.permalink,
        patrocinado: p.patrocinado,
        texto_tamanho: p.texto_tamanho,
        autor: p.autor,
        row_crua: amostraRow.get(p.activity_id) || null
      }))
    };
  }

  function baixaDiag() {
    const blob = new Blob([JSON.stringify(pacoteDiag(), null, 2)],
                          { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diagnostico-autor.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function baixa() {
    const blob = new Blob([JSON.stringify(pacoteAtual(), null, 2)],
                          { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = MODO_SONDA ? 'sonda-comentarios.json' : 'feed-coletado.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // =====================================================================
  // API DE DEPURACAO  (v2.6 - ponto 6)
  // =====================================================================
  // window.__radar.versao passa a vir da constante VERSAO. Era isso que
  // travava a auditoria do agente: ele lia um numero antigo e concluia que
  // a extensao nao tinha atualizado.
  window.__radar = {
    versao: VERSAO,
    modo: MODO_SONDA ? 'sonda' : 'feed',
    get paginas() { return paginas; },
    get posts() { return [...posts.values()]; },
    get sondas() { return sondas.map(s => ({ url: s.url, tamanho: s.tamanho })); },
    stats: estatisticas,
    json: pacoteAtual,
    diag: pacoteDiag,
    baixar: baixa,
    baixarDiag: baixaDiag
  };

  if (document.body) criaPainel();
  else document.addEventListener('DOMContentLoaded', criaPainel);
})();
