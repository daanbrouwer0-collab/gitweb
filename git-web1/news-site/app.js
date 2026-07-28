const DEFAULT_CONFIG = {
  newsUrl: "https://cdn.jsdelivr.net/gh/daanbrouwer0-collab/gitweb@main/news.json",
  dataLinkUrl: "https://github.com/daanbrouwer0-collab/gitweb/blob/main/news.json",
  siteTitle: "Nieuws",
  siteSubtitle: "Berichten worden geladen uit news.json op GitHub.",
  mountSelector: "#news-site-root",
};

const SITE_CONFIG = {
  ...DEFAULT_CONFIG,
  ...(window.NEWS_SITE_CONFIG || {}),
};

function toDateValue(dateString) {
  const d = new Date(dateString);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function escapeText(value) {
  return String(value ?? "");
}

function normalize(text) {
  return escapeText(text).toLowerCase().trim();
}

function buildExcerpt(item) {
  const excerpt = escapeText(item.excerpt);
  if (excerpt) return excerpt;

  const content = escapeText(item.content);
  if (!content) return "";

  const max = 160;
  return content.length <= max ? content : `${content.slice(0, max - 3)}...`;
}

function ensureLayout() {
  const existingList = document.getElementById("newsList");
  if (existingList) return;

  const mount = document.querySelector(SITE_CONFIG.mountSelector) || document.body;
  mount.innerHTML = `
    <header class="header">
      <div class="container">
        <h1 class="title">${escapeText(SITE_CONFIG.siteTitle)}</h1>
        <p class="subtitle">${escapeText(SITE_CONFIG.siteSubtitle)}</p>
      </div>
    </header>
    <main class="container">
      <section class="toolbar" aria-label="Filters">
        <label class="search">
          <span class="sr-only">Zoeken</span>
          <input id="searchInput" type="search" placeholder="Zoek in titel of tekst..." autocomplete="off" />
        </label>
        <div class="meta">
          <span id="countLabel" class="count">-</span>
          <a class="link" href="${escapeText(SITE_CONFIG.dataLinkUrl)}" target="_blank" rel="noreferrer">Bekijk data</a>
        </div>
      </section>
      <section aria-label="Nieuwsberichten">
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <div id="newsList" class="grid"></div>
      </section>
    </main>
  `;
}

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = escapeText(text);
}

function setCountLabel(visibleCount, totalCount) {
  const el = document.getElementById("countLabel");
  if (!el) return;
  el.textContent =
    visibleCount === totalCount ? `${totalCount} bericht(en)` : `${visibleCount} van ${totalCount} bericht(en)`;
}

function createNewsCard(item) {
  const article = document.createElement("article");
  article.className = "card";

  const top = document.createElement("div");
  top.className = "card-top";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = escapeText(item.title || "Zonder titel");

  const date = document.createElement("p");
  date.className = "card-date";
  date.textContent = escapeText(item.date || "");

  top.append(title, date);

  const excerpt = document.createElement("p");
  excerpt.className = "card-excerpt";
  excerpt.textContent = buildExcerpt(item);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const link = document.createElement("a");
  link.className = "button button-primary card-link";

  const url = escapeText(item.url).trim();
  if (url) {
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open";
  } else {
    link.href = "#";
    link.textContent = "Geen link";
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  }

  actions.appendChild(link);
  article.append(top, excerpt, actions);
  return article;
}

function renderNews(items) {
  const list = document.getElementById("newsList");
  if (!list) return;

  list.replaceChildren();
  for (const item of items) {
    list.appendChild(createNewsCard(item));
  }
}

async function loadNews() {
  setStatus("Nieuws laden...");
  const res = await fetch(SITE_CONFIG.newsUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kon nieuws.json niet laden (HTTP ${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("news.json moet een JSON array zijn");
  return data;
}

function sortNews(items) {
  return [...items].sort((a, b) => toDateValue(b.date) - toDateValue(a.date));
}

function wireSearch(allItems) {
  const input = document.getElementById("searchInput");
  if (!(input instanceof HTMLInputElement)) return;

  const total = allItems.length;
  let lastValue = "";

  function applyFilter() {
    const q = normalize(input.value);
    if (q === lastValue) return;
    lastValue = q;

    const filtered =
      q.length === 0
        ? allItems
        : allItems.filter((item) => {
            const haystack = `${normalize(item.title)} ${normalize(item.excerpt)} ${normalize(item.content)}`;
            return haystack.includes(q);
          });

    renderNews(filtered);
    setCountLabel(filtered.length, total);
    setStatus(filtered.length === 0 ? "Geen berichten gevonden." : "");
  }

  input.addEventListener("input", applyFilter);
  applyFilter();
}

async function main() {
  ensureLayout();

  try {
    const raw = await loadNews();
    const items = sortNews(raw);
    renderNews(items);
    setCountLabel(items.length, items.length);
    setStatus(items.length === 0 ? "Nog geen nieuwsberichten." : "");
    wireSearch(items);
  } catch (err) {
    setStatus("Kon nieuws niet laden. Controleer of news.json bestaat en geldig JSON is in je GitHub repository.");
    const list = document.getElementById("newsList");
    if (list) list.replaceChildren();
  }
}

main();
