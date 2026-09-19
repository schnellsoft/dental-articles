(() => {
  const LANGS = ["ro", "bg", "en"];
  const state = {
    lang: localStorage.getItem("dental-lang") || "ro",
    catalog: null,
    route: { name: "home" },
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ui() {
    return state.catalog.ui[state.lang];
  }

  function parseRoute() {
    const raw = decodeURIComponent(location.hash.replace(/^#/, "") || "/");
    const parts = raw.split("/").filter(Boolean);
    if (parts[0] === "a" && parts[1]) return { name: "article", slug: parts[1] };
    if (parts[0] === "c" && parts[1] && parts[2]) {
      return { name: "subcategory", cat: parts[1], sub: parts[2] };
    }
    if (parts[0] === "c" && parts[1]) return { name: "category", cat: parts[1] };
    if (parts[0] === "q") return { name: "search", q: parts.slice(1).join("/") };
    return { name: "home" };
  }

  function uniqueArticles() {
    const map = new Map();
    for (const article of state.catalog.articles) {
      if (!map.has(article.slug)) map.set(article.slug, article);
    }
    return [...map.values()];
  }

  function articlesIn(cat, sub = null) {
    const seen = new Set();
    return state.catalog.articles.filter((article) => {
      if (article.categoryId !== cat) return false;
      if (sub && article.subcategoryId !== sub) return false;
      if (seen.has(article.slug)) return false;
      seen.add(article.slug);
      return true;
    });
  }

  function bySlug(slug) {
    return uniqueArticles().find((article) => article.slug === slug);
  }

  function catNode(id) {
    return state.catalog.tree.find((node) => node.id === id);
  }

  function subNode(catId, subId) {
    const cat = catNode(catId);
    return cat?.children.find((child) => child.type === "subcategory" && child.id === subId);
  }

  function glyph(src) {
    return `<span class="glyph" style="--g:url('${esc(src)}')" aria-hidden="true"></span>`;
  }

  function isCurrent(kind, a, b) {
    const route = state.route;
    if (kind === "home") return route.name === "home";
    if (kind === "article") return route.name === "article" && route.slug === a;
    if (kind === "category") return route.name === "category" && route.cat === a;
    if (kind === "sub") return route.name === "subcategory" && route.cat === a && route.sub === b;
    return false;
  }

  function shouldOpen(cat) {
    const route = state.route;
    if (route.name === "category" && route.cat === cat.id) return true;
    if (route.name === "subcategory" && route.cat === cat.id) return true;
    if (route.name === "article") {
      const article = bySlug(route.slug);
      return article?.categoryId === cat.id;
    }
    return false;
  }

  function shouldOpenSub(catId, sub) {
    const route = state.route;
    if (route.name === "subcategory" && route.cat === catId && route.sub === sub.id) return true;
    if (route.name === "article") {
      const article = bySlug(route.slug);
      return article?.categoryId === catId && article?.subcategoryId === sub.id;
    }
    return false;
  }

  function serviceItems(children) {
    return children
      .filter((child) => child.type === "service")
      .map((child) => bySlug(child.slug))
      .filter(Boolean);
  }

  function renderTree() {
    const lang = state.lang;
    return `<ul class="tree">${state.catalog.tree
      .map((cat) => {
        const services = serviceItems(cat.children);
        const subs = cat.children.filter((child) => child.type === "subcategory");
        return `<li>
          <details ${shouldOpen(cat) ? "open" : ""}>
            <summary>
              ${glyph(cat.icon)}
              <a href="#/c/${esc(cat.id)}" ${isCurrent("category", cat.id) ? 'aria-current="page"' : ""}>${esc(cat.name[lang])}</a>
            </summary>
            ${
              services.length
                ? `<ul class="svc-list">${services
                    .map(
                      (svc) => `<li>
                  <a href="#/a/${esc(svc.slug)}" ${isCurrent("article", svc.slug) ? 'aria-current="page"' : ""}>
                    ${glyph(svc.icon)}${esc(svc.title[lang])}
                  </a>
                </li>`
                    )
                    .join("")}</ul>`
                : ""
            }
            ${subs
              .map((sub) => {
                const nested = serviceItems(sub.children);
                return `<details class="sub-list" ${shouldOpenSub(cat.id, sub) ? "open" : ""}>
                  <summary>
                    ${glyph(sub.icon)}
                    <a href="#/c/${esc(cat.id)}/${esc(sub.id)}" ${
                      isCurrent("sub", cat.id, sub.id) ? 'aria-current="page"' : ""
                    }>${esc(sub.name[lang])}</a>
                  </summary>
                  <ul class="svc-list">${nested
                    .map(
                      (svc) => `<li>
                    <a href="#/a/${esc(svc.slug)}" ${isCurrent("article", svc.slug) ? 'aria-current="page"' : ""}>
                      ${glyph(svc.icon)}${esc(svc.title[lang])}
                    </a>
                  </li>`
                    )
                    .join("")}</ul>
                </details>`;
              })
              .join("")}
          </details>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function card(article, heading, fetchPriority) {
    const t = ui();
    const lang = state.lang;
    const img = article.preview || `images/${previewImage(article)}`;
    return `<a class="card" href="#/a/${esc(article.slug)}">
      <img src="${esc(img)}" alt="" width="640" height="360" ${fetchPriority ? 'fetchpriority="high"' : 'loading="lazy"'}>
      <div class="card-kicker">${glyph(article.icon)}${esc(t.read)}</div>
      <${heading}>${esc(article.title[lang])}</${heading}>
      <p>${esc(article.synopsis[lang])}</p>
      <span class="price">${esc(t.price)}: ${esc(article.price)} ${esc(article.currency)}</span>
    </a>`;
  }

  function previewImage(article) {
    if (article.subcategoryId === "removable-prosthetics") return "denture.jpg";
    if (article.subcategoryId === "treatments-with-microscope") return "microscope.jpg";
    const map = {
      consultations: "consult.jpg",
      prophylaxis: "hygiene.jpg",
      "restorative-dentistry": "restorative.jpg",
      endodontics: "endo.jpg",
      "dental-prosthetics": "crown.jpg",
      "dento-alveolar-surgery": "surgery.jpg",
      implantology: "implant.jpg",
      periodontology: "perio.jpg",
      "pediatric-dentistry": "pediatric.jpg",
      aesthetics: "aesthetic.jpg",
      orthodontics: "ortho.jpg",
    };
    return map[article.categoryId] || "consult.jpg";
  }

  function renderHome() {
    const t = ui();
    const cards = state.catalog.recommended
      .map((slug, index) => bySlug(slug))
      .filter(Boolean)
      .map((article, index) => card(article, "h2", index === 0))
      .join("");
    return `<div class="page-title">
        <h1>${esc(t.recommended)}</h1>
        <p class="lede">${esc(t.recommendedLead)}</p>
      </div>
      <div class="card-grid">${cards}</div>`;
  }

  function renderList(title, items) {
    const t = ui();
    if (!items.length) return `<p class="status">${esc(t.noResults)}</p>`;
    return `<div class="page-title"><h1>${esc(title)}</h1></div>
      <div class="card-grid">${items.map((article, index) => card(article, "h2", index === 0)).join("")}</div>`;
  }

  function searchArticles(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    return uniqueArticles().filter((article) => {
      if (seen.has(article.slug)) return false;
      const blob = `${article.title[state.lang]} ${article.synopsis[state.lang]} ${article.search[state.lang]}`.toLowerCase();
      if (!blob.includes(q)) return false;
      seen.add(article.slug);
      return true;
    });
  }

  async function renderArticle(slug) {
    const t = ui();
    const res = await fetch(`./${state.lang}/${encodeURIComponent(slug)}.json`);
    if (!res.ok) {
      return `<p class="status">${esc(t.noResults)}</p>`;
    }
    const article = await res.json();
    const catHref = `#/c/${article.categoryId}`;
    const subHref = article.subcategoryId ? `#/c/${article.categoryId}/${article.subcategoryId}` : null;
    const figures = article.images.slice(0, 3);
    const lead = figures[0]
      ? `<figure>
            <img src="${esc(figures[0].src)}" alt="${esc(figures[0].alt)}" width="1280" height="720" fetchpriority="high">
          </figure>`
      : "";
    const mid = figures[1]
      ? `<figure>
            <img src="${esc(figures[1].src)}" alt="${esc(figures[1].alt)}" width="1280" height="720" loading="lazy">
          </figure>`
      : "";
    const last = figures[2]
      ? `<figure>
            <img src="${esc(figures[2].src)}" alt="${esc(figures[2].alt)}" width="1280" height="720" loading="lazy">
          </figure>`
      : "";
    const rest = article.paragraphs
      .slice(1)
      .map((p) => `<p>${esc(p)}</p>`)
      .join("");
    const body = `${lead}<p>${esc(article.paragraphs[0] || "")}</p>${mid}${rest}${last}`;

    return `<article class="article-hero">
      <div class="card-kicker">${glyph(article.icon)}${esc(article.categoryName)}</div>
      <h1>${esc(article.title)}</h1>
      <p class="lede">${esc(article.synopsis)}</p>
      <div class="article-meta">
        <span class="price">${esc(t.price)}: ${esc(article.price)} ${esc(article.currency)}</span>
        <a href="${catHref}">${esc(t.category)}: ${esc(article.categoryName)}</a>
        ${
          article.subcategoryName
            ? `<a href="${subHref}">${esc(t.subcategory)}: ${esc(article.subcategoryName)}</a>`
            : ""
        }
      </div>
      <div class="article-body">${body}</div>
    </article>`;
  }

  async function renderMain() {
    const t = ui();
    const route = state.route;
    if (route.name === "article") return renderArticle(route.slug);
    if (route.name === "search") {
      const items = searchArticles(route.q);
      return renderList(`${t.results}: “${route.q}”`, items);
    }
    if (route.name === "category") {
      const cat = catNode(route.cat);
      const title = cat ? `${t.allIn} ${cat.name[state.lang]}` : t.results;
      return renderList(title, articlesIn(route.cat));
    }
    if (route.name === "subcategory") {
      const sub = subNode(route.cat, route.sub);
      const title = sub ? `${t.allIn} ${sub.name[state.lang]}` : t.results;
      return renderList(title, articlesIn(route.cat, route.sub));
    }
    return renderHome();
  }

  function searchHash(query) {
    const q = query.trim();
    return q ? `#/q/${encodeURIComponent(q)}` : "#/";
  }

  function syncSearchRoute(query) {
    const next = searchHash(query);
    if (location.hash === next) return;
    history.replaceState(null, "", next);
  }

  function isTypingSearch() {
    return document.activeElement === $("#search-input");
  }

  function renderChrome() {
    const t = ui();
    document.documentElement.lang = state.lang;
    document.title = t.appTitle;
    $("#brand-title").textContent = t.appTitle;
    $("#brand-tag").textContent = t.tagline;
    const search = $("#search-input");
    search.placeholder = t.search;
    search.setAttribute("aria-label", t.search);
    if (!isTypingSearch()) {
      search.value = state.route.name === "search" ? state.route.q || "" : "";
    }
    $("#lang-select").value = state.lang;
    $("#lang-select").setAttribute("aria-label", t.language);
    $("#browse-label").textContent = t.browse;
    $("#tree-root").innerHTML = renderTree();
  }

  let paintSeq = 0;

  async function paint({ focusMain = true, chrome = true } = {}) {
    const seq = ++paintSeq;
    state.route = parseRoute();
    if (chrome) renderChrome();
    const html = `<div class="content-inner">${await renderMain()}</div>`;
    if (seq !== paintSeq) return;
    const main = $("#main");
    main.innerHTML = html;
    if (focusMain && !isTypingSearch() && document.activeElement !== $("#lang-select")) {
      main.focus({ preventScroll: true });
    }
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    if (LANGS.includes(params.get("lang"))) {
      state.lang = params.get("lang");
      localStorage.setItem("dental-lang", state.lang);
    }
    if (!LANGS.includes(state.lang)) state.lang = "ro";
    const res = await fetch("./catalog.json");
    state.catalog = await res.json();
    $("#lang-select").addEventListener("change", (event) => {
      state.lang = event.target.value;
      localStorage.setItem("dental-lang", state.lang);
      paint({ focusMain: false });
    });
    $("#search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const search = $("#search-input");
      syncSearchRoute(search.value);
      paint({ focusMain: false, chrome: false });
      search.focus();
    });
    $("#search-input").addEventListener("input", (event) => {
      syncSearchRoute(event.target.value);
      paint({ focusMain: false, chrome: false });
    });
    window.addEventListener("hashchange", () => paint());
    await paint();
  }

  init().catch((error) => {
    $("#main").textContent = error.message;
  });
})();
