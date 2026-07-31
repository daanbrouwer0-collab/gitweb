const DEFAULT_CONFIG = {
  newsUrl: "./news.json",
  dataLinkUrl: "./news.json",
  siteTitle: "Nieuws",
  siteSubtitle: "Berichten worden geladen uit news.json in deze repository.",
  mountSelector: "#news-site-root",
  jsonBin: null,
};

const SITE_CONFIG = {
  ...DEFAULT_CONFIG,
  ...(window.NEWS_SITE_CONFIG || {}),
  jsonBin: {
    ...(DEFAULT_CONFIG.jsonBin || {}),
    ...((window.NEWS_SITE_CONFIG && window.NEWS_SITE_CONFIG.jsonBin) || {}),
  },
};

function getJsonBinConfig() {
  const binId = escapeText(SITE_CONFIG.jsonBin?.binId).trim();
  const apiKey = escapeText(SITE_CONFIG.jsonBin?.apiKey).trim();
  if (!binId || !apiKey) return null;
  if (binId.startsWith("PLAK_") || apiKey.startsWith("PLAK_")) return null;
  // Access Key (aanbevolen) of Master Key; default: X-Master-Key
  const keyHeader = escapeText(SITE_CONFIG.jsonBin?.keyHeader).trim() || "X-Master-Key";
  return { binId, apiKey, keyHeader };
}

function jsonBinHeaders(jsonBin, withContentType = false) {
  const headers = {
    [jsonBin.keyHeader]: jsonBin.apiKey,
    "X-Bin-Meta": "false",
  };
  if (withContentType) headers["Content-Type"] = "application/json";
  return headers;
}

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
    <footer class="footer">
      <div class="container footer-inner">
        <button type="button" id="addNewsBtn" class="button button-primary">Add nieuws</button>
      </div>
    </footer>
    <dialog id="addNewsDialog" class="dialog">
      <form id="addNewsForm" method="dialog" class="dialog-form">
        <h2 class="dialog-title">Nieuw bericht</h2>
        <label class="field">
          <span>Titel</span>
          <input name="title" type="text" required autocomplete="off" />
        </label>
        <label class="field">
          <span>Datum</span>
          <input name="date" type="date" required />
        </label>
        <label class="field">
          <span>Samenvatting</span>
          <textarea name="excerpt" rows="2"></textarea>
        </label>
        <label class="field">
          <span>Link (optioneel)</span>
          <input name="url" type="url" placeholder="https://" autocomplete="off" />
        </label>
        <label class="field">
          <span>Inhoud</span>
          <textarea name="content" rows="4"></textarea>
        </label>
        <div class="dialog-actions">
          <button type="button" id="cancelAddNews" class="button">Annuleren</button>
          <button type="submit" class="button button-primary">Toevoegen</button>
        </div>
      </form>
    </dialog>
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

function extractNewsArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.record)) return data.record;
  throw new Error("Nieuwsdata moet een JSON array zijn");
}

async function loadNews() {
  setStatus("Nieuws laden...");
  const jsonBin = getJsonBinConfig();

  if (jsonBin) {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${jsonBin.binId}/latest`, {
      cache: "no-store",
      headers: jsonBinHeaders(jsonBin),
    });
    if (!res.ok) throw new Error(`Kon JSONBin niet laden (HTTP ${res.status})`);
    return extractNewsArray(await res.json());
  }

  const res = await fetch(SITE_CONFIG.newsUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kon news.json niet laden (HTTP ${res.status})`);
  return extractNewsArray(await res.json());
}

async function saveNews(items) {
  const jsonBin = getJsonBinConfig();
  if (!jsonBin) {
    downloadNewsJson(items);
    return { mode: "download" };
  }

  const res = await fetch(`https://api.jsonbin.io/v3/b/${jsonBin.binId}`, {
    method: "PUT",
    headers: jsonBinHeaders(jsonBin, true),
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Kon JSONBin niet opslaan (HTTP ${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return { mode: "jsonbin" };
}

function sortNews(items) {
  return [...items].sort((a, b) => toDateValue(b.date) - toDateValue(a.date));
}

function wireSearch(getItems) {
  const input = document.getElementById("searchInput");
  if (!(input instanceof HTMLInputElement)) return;

  let lastValue = null;

  function applyFilter() {
    const allItems = getItems();
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
    setCountLabel(filtered.length, allItems.length);
    setStatus(filtered.length === 0 ? "Geen berichten gevonden." : "");
  }

  input.addEventListener("input", applyFilter);
  applyFilter();

  return () => {
    lastValue = null;
    applyFilter();
  };
}

function slugify(text) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function downloadNewsJson(items) {
  const blob = new Blob([`${JSON.stringify(items, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "news.json";
  a.click();
  URL.revokeObjectURL(url);
}

function wireAddNews(getItems, setItems, refresh) {
  const btn = document.getElementById("addNewsBtn");
  const dialog = document.getElementById("addNewsDialog");
  const form = document.getElementById("addNewsForm");
  const cancel = document.getElementById("cancelAddNews");

  if (!(btn && dialog instanceof HTMLDialogElement && form instanceof HTMLFormElement)) return;

  btn.addEventListener("click", () => {
    const dateInput = form.elements.namedItem("date");
    if (dateInput instanceof HTMLInputElement && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    dialog.showModal();
  });

  cancel?.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const title = escapeText(data.get("title")).trim();
    const date = escapeText(data.get("date")).trim();
    const excerpt = escapeText(data.get("excerpt")).trim();
    const url = escapeText(data.get("url")).trim();
    const content = escapeText(data.get("content")).trim();

    if (!title || !date) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
    setStatus("Bericht opslaan...");

    const previous = getItems();
    const id = `${date}-${slugify(title) || "bericht"}`;
    const next = sortNews([{ id, title, date, excerpt, url, content }, ...previous]);
    setItems(next);
    refresh();

    try {
      const result = await saveNews(next);
      form.reset();
      dialog.close();
      setStatus(
        result.mode === "jsonbin"
          ? "Bericht toegevoegd en opgeslagen op JSONBin."
          : "Bericht toegevoegd. Download news.json en commit die naar de repo.",
      );
    } catch (err) {
      setItems(previous);
      refresh();
      setStatus("Opslaan mislukt. Controleer je JSONBin bin-id en API-key.");
    } finally {
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });
}

async function main() {
  const jsonBin = getJsonBinConfig();
  if (jsonBin && (!SITE_CONFIG.dataLinkUrl || SITE_CONFIG.dataLinkUrl === DEFAULT_CONFIG.dataLinkUrl)) {
    SITE_CONFIG.dataLinkUrl = `https://jsonbin.io/app/bins/${jsonBin.binId}`;
  }

  ensureLayout();

  let items = [];
  const getItems = () => items;
  const setItems = (next) => {
    items = next;
  };

  try {
    const raw = await loadNews();
    items = sortNews(raw);
    const refresh = wireSearch(getItems);
    wireAddNews(getItems, setItems, refresh);
    setStatus(items.length === 0 ? "Nog geen nieuwsberichten." : "");
  } catch (err) {
    setStatus(
      jsonBin
        ? "Kon nieuws niet laden van JSONBin. Controleer bin-id en API-key."
        : "Kon nieuws niet laden. Controleer of news.json bestaat en geldig JSON is.",
    );
    const list = document.getElementById("newsList");
    if (list) list.replaceChildren();
    const refresh = wireSearch(getItems);
    wireAddNews(getItems, setItems, refresh);
  }
}

main();
