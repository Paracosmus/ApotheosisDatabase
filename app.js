/* ═══════════════════════════════════════════════
   Apotheosis Database — Main Application
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Configuration ─────────────────────────
  const CONFIG = {
    API_PROD: 'https://get.lunehub.com/apotheosis/source/cards.json',
    API_DEV: 'https://get.lunehub.com/apotheosis/source/dev-cards.json',
    IMAGE_BASE: 'https://get.lunehub.com/apotheosis/prints/',
    IMAGE_EXT: '.avif',
    VIRTUAL_BUFFER: 10,       // extra items rendered above/below viewport
    BATCH_SIZE: 40,            // items per render batch
    SKELETON_COUNT: 12,
  };

  const SUIT_MAP = {
    House: 'suit-house',
    Class: 'suit-class',
    Entity: 'suit-entity',
    Item: 'suit-item',
    Skill: 'suit-skill',
    Companion: 'suit-companion',
    Event: 'suit-event',
    Summus: 'suit-summus',
  };

  const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  const SUIT_ORDER = ['House', 'Class', 'Entity', 'Item', 'Skill', 'Companion', 'Event', 'Summus'];

  // ── State ─────────────────────────────────
  const state = {
    allCards: [],
    filteredCards: [],
    renderedCount: 0,
    viewMode: 'compact',   // compact | medium | large
    isLoading: false,
    hasSearched: false,
    dataReady: false,
  };

  // ── DOM References ────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    filterName: $('#filter-name'),
    filterSuit: $('#filter-suit'),
    filterRarity: $('#filter-rarity'),
    filterArtist: $('#filter-artist'),
    filterKnowledge: $('#filter-knowledge'),
    sortBy: $('#sort-by'),
    btnSearch: $('#btn-search'),
    btnRetry: $('#btn-retry'),
    emptyState: $('#empty-state'),
    errorState: $('#error-state'),
    errorMessage: $('#error-message'),
    noResultsState: $('#no-results-state'),
    skeletonState: $('#skeleton-state'),
    skeletonContainer: $('#skeleton-container'),
    cardListSection: $('#card-list-section'),
    cardList: $('#card-list'),
    scrollSentinel: $('#scroll-sentinel'),
    resultsCount: $('#results-count'),
    themeToggle: $('#theme-toggle'),
    modalOverlay: $('#card-modal-overlay'),
    modalPanel: $('#card-modal'),
    modalClose: $('#modal-close'),
    modalContent: $('#modal-content'),
    viewCompact: $('#view-compact'),
    viewMedium: $('#view-medium'),
    viewLarge: $('#view-large'),
  };

  // ── Service Worker Registration ───────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[App] SW registered, scope:', reg.scope))
        .catch((err) => console.warn('[App] SW registration failed:', err));
    });
  }

  // ── Theme Manager ─────────────────────────
  function initTheme() {
    const stored = localStorage.getItem('apotheosis-theme');
    // Default to dark mode on first access; respect stored preference afterwards
    if (stored === 'dark' || !stored) {
      document.documentElement.classList.add('dark');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0a0a0a');
    } else {
      document.documentElement.classList.remove('dark');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#fafafa');
    }

    dom.themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('apotheosis-theme', isDark ? 'dark' : 'light');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#0a0a0a' : '#fafafa');
    });
  }

  // ── Data Fetching ─────────────────────────
  function getApiUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('dev') === 'true' ? CONFIG.API_DEV : CONFIG.API_PROD;
  }

  async function fetchCards() {
    const url = getApiUrl();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    let text;

    // Handle UTF-16LE BOM
    const view = new Uint8Array(buffer);
    if (view[0] === 0xFF && view[1] === 0xFE) {
      text = new TextDecoder('utf-16le').decode(buffer);
    } else {
      text = new TextDecoder('utf-8').decode(buffer);
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('Invalid data format');
    return data;
  }

  // ── Filter Population ─────────────────────
  function populateFilters(cards) {
    const suits = new Set();
    const rarities = new Set();
    const artists = new Set();
    const knowledges = new Set();

    cards.forEach((card) => {
      if (card.Suit) suits.add(card.Suit);
      if (card.Rarity) rarities.add(card.Rarity);
      if (card.Artist && card.Artist.trim()) artists.add(card.Artist.trim());
      if (card.Knowledges) card.Knowledges.forEach((k) => knowledges.add(k));
    });

    fillSelect(dom.filterSuit, sortByOrder([...suits], SUIT_ORDER));
    fillSelect(dom.filterRarity, sortByOrder([...rarities], RARITY_ORDER));
    fillSelect(dom.filterArtist, [...artists].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    fillSelect(dom.filterKnowledge, [...knowledges].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  }

  function fillSelect(selectEl, items) {
    const firstOption = selectEl.querySelector('option');
    selectEl.innerHTML = '';
    selectEl.appendChild(firstOption);
    items.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      selectEl.appendChild(opt);
    });
  }

  function sortByOrder(arr, order) {
    return arr.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  // ── Filtering & Sorting ───────────────────
  function applyFilters() {
    const nameQuery = dom.filterName.value.trim().toLowerCase();
    const suit = dom.filterSuit.value;
    const rarity = dom.filterRarity.value;
    const artist = dom.filterArtist.value;
    const knowledge = dom.filterKnowledge.value;

    let results = state.allCards.filter((card) => {
      if (nameQuery && !card.Name.toLowerCase().includes(nameQuery) && !card.Id.toLowerCase().includes(nameQuery)) return false;
      if (suit && card.Suit !== suit) return false;
      if (rarity && card.Rarity !== rarity) return false;
      if (artist && (card.Artist || '').trim() !== artist) return false;
      if (knowledge && !(card.Knowledges || []).includes(knowledge)) return false;
      return true;
    });

    results = sortCards(results, dom.sortBy.value);
    return results;
  }

  function sortCards(cards, sortKey) {
    const copy = [...cards];
    switch (sortKey) {
      case 'name':
        return copy.sort((a, b) => (a.Name || '').localeCompare(b.Name || '', 'pt-BR'));
      case 'rarity':
        return copy.sort((a, b) => {
          const ra = RARITY_ORDER.indexOf(a.Rarity);
          const rb = RARITY_ORDER.indexOf(b.Rarity);
          if (ra !== rb) return ra - rb;
          return (a.Name || '').localeCompare(b.Name || '', 'pt-BR');
        });
      case 'suit':
        return copy.sort((a, b) => {
          const sa = SUIT_ORDER.indexOf(a.Suit);
          const sb = SUIT_ORDER.indexOf(b.Suit);
          if (sa !== sb) return sa - sb;
          return (a.Name || '').localeCompare(b.Name || '', 'pt-BR');
        });
      case 'level':
        return copy.sort((a, b) => {
          if ((a.Level || 0) !== (b.Level || 0)) return (a.Level || 0) - (b.Level || 0);
          return (a.Name || '').localeCompare(b.Name || '', 'pt-BR');
        });
      default:
        return copy;
    }
  }

  // ── Card Renderers ────────────────────────
  function getImageUrl(card) {
    return CONFIG.IMAGE_BASE + card.Id + CONFIG.IMAGE_EXT;
  }

  function getSuitClass(suit) {
    return SUIT_MAP[suit] || '';
  }

  function getRarityClass(rarity) {
    return 'rarity-' + (rarity || 'common').toLowerCase();
  }

  function getBadgeRarityClass(rarity) {
    return 'badge-rarity-' + (rarity || 'common').toLowerCase();
  }

  function renderCompactCard(card) {
    const el = document.createElement('div');
    el.className = 'card-compact';
    el.setAttribute('data-card-id', card.Id);
    el.innerHTML = `
      <span class="card-compact-name">${esc(card.Name)}</span>
      <span class="card-compact-suit ${getSuitClass(card.Suit)}">${esc(card.Suit)}</span>
      <span class="card-compact-rarity"><span class="rarity-dot ${getRarityClass(card.Rarity)}"></span>${esc(card.Rarity)}</span>
    `;
    el.addEventListener('click', () => openModal(card));
    return el;
  }

  function renderMediumCard(card) {
    const el = document.createElement('div');
    el.className = 'card-medium';
    el.setAttribute('data-card-id', card.Id);
    el.innerHTML = `
      <div class="card-medium-img-wrap">
        <img src="${getImageUrl(card)}" alt="${esc(card.Name)}" loading="lazy" decoding="async">
      </div>
      <div class="card-medium-info">
        <div class="card-medium-name">${esc(card.Name)}</div>
        <div class="card-medium-meta">
          <span class="card-medium-suit ${getSuitClass(card.Suit)}">${esc(card.Suit)}</span>
          <span class="card-medium-rarity"><span class="rarity-dot ${getRarityClass(card.Rarity)}"></span>${esc(card.Rarity)}</span>
        </div>
      </div>
    `;
    el.addEventListener('click', () => openModal(card));
    return el;
  }

  function renderLargeCard(card) {
    const el = document.createElement('div');
    el.className = 'card-large';
    el.setAttribute('data-card-id', card.Id);
    el.innerHTML = `
      <img src="${getImageUrl(card)}" alt="${esc(card.Name)}" loading="lazy" decoding="async">
      <div class="card-large-overlay">
        <div class="card-large-name">${esc(card.Name)}</div>
        <div class="card-large-meta">
          <span class="card-large-suit ${getSuitClass(card.Suit)}">${esc(card.Suit)}</span>
          <span>${esc(card.Rarity)}</span>
        </div>
      </div>
    `;
    el.addEventListener('click', () => openModal(card));
    return el;
  }

  function renderCard(card) {
    switch (state.viewMode) {
      case 'compact': return renderCompactCard(card);
      case 'medium':  return renderMediumCard(card);
      case 'large':   return renderLargeCard(card);
      default:        return renderCompactCard(card);
    }
  }

  // ── Virtual / Progressive Rendering ───────
  function renderBatch() {
    const start = state.renderedCount;
    const end = Math.min(start + CONFIG.BATCH_SIZE, state.filteredCards.length);
    if (start >= end) return;

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      fragment.appendChild(renderCard(state.filteredCards[i]));
    }
    dom.cardList.appendChild(fragment);
    state.renderedCount = end;

    dom.resultsCount.textContent = `${state.filteredCards.length} carta${state.filteredCards.length !== 1 ? 's' : ''}`;
  }

  function clearCardList() {
    dom.cardList.innerHTML = '';
    state.renderedCount = 0;
  }

  function displayCards(cards) {
    state.filteredCards = cards;
    clearCardList();

    // Update grid class
    dom.cardList.className = 'card-grid view-' + state.viewMode;

    if (cards.length === 0) {
      hideAll();
      dom.noResultsState.classList.remove('hidden');
      dom.resultsCount.textContent = '0 cartas';
      return;
    }

    hideAll();
    dom.cardListSection.classList.remove('hidden');
    renderBatch();
  }

  // IntersectionObserver for infinite scroll
  function setupScrollObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && state.renderedCount < state.filteredCards.length) {
          renderBatch();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(dom.scrollSentinel);
  }

  // ── Skeleton Screens ──────────────────────
  function showSkeletons() {
    dom.skeletonContainer.innerHTML = '';
    dom.skeletonContainer.className = 'card-grid view-' + state.viewMode;

    const count = CONFIG.SKELETON_COUNT;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      if (state.viewMode === 'compact') {
        el.className = 'skeleton skeleton-compact';
      } else if (state.viewMode === 'medium') {
        el.className = 'skeleton-medium';
        el.innerHTML = `
          <div class="skeleton skeleton-medium-img"></div>
          <div class="skeleton-medium-text">
            <div class="skeleton skeleton-medium-title"></div>
            <div class="skeleton skeleton-medium-meta"></div>
          </div>
        `;
      } else {
        el.className = 'skeleton skeleton-large';
      }
      fragment.appendChild(el);
    }

    dom.skeletonContainer.appendChild(fragment);
    hideAll();
    dom.skeletonState.classList.remove('hidden');
  }

  // ── State Visibility ──────────────────────
  function hideAll() {
    dom.emptyState.classList.add('hidden');
    dom.errorState.classList.add('hidden');
    dom.noResultsState.classList.add('hidden');
    dom.skeletonState.classList.add('hidden');
    dom.cardListSection.classList.add('hidden');
  }

  function showError(message) {
    hideAll();
    dom.errorMessage.textContent = message || 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    dom.errorState.classList.remove('hidden');
    dom.resultsCount.textContent = '';
  }

  // ── Preload Data on Init ──────────────────
  async function preloadData() {
    try {
      state.allCards = await fetchCards();
      populateFilters(state.allCards);
      state.dataReady = true;
      console.log('[App] Data preloaded:', state.allCards.length, 'cards');
    } catch (err) {
      console.error('[App] Preload failed:', err);
      // Filters will stay empty; user can retry via Buscar
    }
  }

  // ── Search Action ─────────────────────────
  async function performSearch() {
    if (state.isLoading) return;

    // If data not yet loaded (preload failed), try fetching now
    if (!state.dataReady) {
      state.isLoading = true;
      showSkeletons();

      try {
        state.allCards = await fetchCards();
        populateFilters(state.allCards);
        state.dataReady = true;
      } catch (err) {
        console.error('[App] Fetch failed:', err);
        showError('Falha ao carregar dados: ' + err.message);
        state.isLoading = false;
        return;
      }

      state.isLoading = false;
    }

    state.hasSearched = true;
    const results = applyFilters();
    displayCards(results);
  }

  // ── Card Detail Modal ─────────────────────
  function openModal(card) {
    dom.modalContent.innerHTML = buildModalHTML(card);
    dom.modalOverlay.classList.remove('hidden');

    // Trigger reflow then add visible class for animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dom.modalOverlay.classList.add('visible');
      });
    });

    document.body.style.overflow = 'hidden';

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('card', card.Id);
    history.replaceState(null, '', url);

    // Setup share button
    const shareBtn = dom.modalContent.querySelector('.btn-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => shareCard(card, shareBtn));
    }
  }

  function closeModal() {
    dom.modalOverlay.classList.remove('visible');
    document.body.style.overflow = '';

    setTimeout(() => {
      dom.modalOverlay.classList.add('hidden');
      dom.modalContent.innerHTML = '';
    }, 400);

    // Remove card param from URL
    const url = new URL(window.location);
    url.searchParams.delete('card');
    history.replaceState(null, '', url);
  }

  function buildModalHTML(card) {
    const suitClass = getSuitClass(card.Suit);
    const rarityBadge = getBadgeRarityClass(card.Rarity);

    let html = `
      <div class="modal-body">
      <div class="modal-left">
        <div class="modal-hero">
          <img src="${getImageUrl(card)}" alt="${esc(card.Name)}" loading="eager">
        </div>
      </div>
      <div class="modal-right">
      <div class="modal-card-header">
        <h2 class="modal-card-name">${esc(card.Name)}</h2>
        <div class="modal-card-badges">
          <span class="badge ${suitClass}">${esc(card.Suit)}</span>
          <span class="badge ${rarityBadge}">${esc(card.Rarity)}</span>
          ${card.Type ? `<span class="badge badge-outline">${esc(card.Type)}</span>` : ''}
          ${card.Category ? `<span class="badge badge-outline">${esc(card.Category)}</span>` : ''}
        </div>
      </div>
    `;

    // Stats grid
    const stats = [];
    if (card.Level != null) stats.push(['Nível', card.Level]);
    if (card.Score != null) stats.push(['Score', card.Score]);
    if (card.Action != null) stats.push(['Ação', card.Action]);
    if (card.Mana != null) stats.push(['Mana', card.Mana]);
    if (card.Stamina != null) stats.push(['Stamina', card.Stamina]);
    if (card.Essence != null) stats.push(['Essência', card.Essence]);
    if (card.CollectionIndex != null) stats.push(['Coleção #', card.CollectionIndex]);

    if (stats.length > 0) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Estatísticas</div>
        <div class="modal-stats-grid">
          ${stats.map(([label, val]) => `
            <div class="modal-stat">
              <div class="modal-stat-label">${label}</div>
              <div class="modal-stat-value">${val}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Attributes
    const attrs = card.Attributes || card.AttributesBonus;
    if (attrs) {
      const attrTitle = card.Attributes ? 'Atributos' : 'Bônus de Atributos';
      const attrEntries = Object.entries(attrs).filter(([, v]) => v !== 0);
      if (attrEntries.length > 0) {
        html += `<div class="modal-section">
          <div class="modal-section-title">${attrTitle}</div>
          <div class="modal-stats-grid">
            ${attrEntries.map(([key, val]) => `
              <div class="modal-stat">
                <div class="modal-stat-label">${esc(key)}</div>
                <div class="modal-stat-value">${val > 0 ? '+' + val : val}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
      }
    }

    // Knowledges
    if (card.Knowledges && card.Knowledges.length > 0) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Conhecimentos</div>
        <div class="modal-card-badges">
          ${card.Knowledges.map((k) => `<span class="badge badge-outline">${esc(k)}</span>`).join('')}
        </div>
      </div>`;
    }

    // Tags
    if (card.Tags && card.Tags.length > 0) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Tags</div>
        <div class="modal-card-badges">
          ${card.Tags.map((t) => `<span class="badge badge-outline">${esc(t)}</span>`).join('')}
        </div>
      </div>`;
    }

    // Effects
    if (card.Effects && card.Effects.length > 0) {
      const nonEmptyEffects = card.Effects.filter((e) => e.Text || e.Keywords);
      if (nonEmptyEffects.length > 0) {
        html += `<div class="modal-section">
          <div class="modal-section-title">Efeitos</div>
          <div class="modal-effects">
            ${nonEmptyEffects.map((eff) => `
              <div class="modal-effect">
                ${eff.Name ? `<div class="modal-effect-keywords">${esc(eff.Name)}</div>` : ''}
                ${eff.Keywords && eff.Keywords !== '(GameplayTags=)' ? `<div class="modal-effect-keywords">${esc(eff.Keywords)}</div>` : ''}
                <div class="modal-effect-text">${formatEffectText(eff.Text)}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
      }
    }

    // Class-specific
    if (card.Path) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Caminho</div>
        <p style="color:var(--text-secondary)">${esc(card.Path)}</p>
      </div>`;
    }

    // Slots
    const slots = [];
    if (card.EquipmentSlots != null) slots.push(['Equipamento', card.EquipmentSlots]);
    if (card.MementoSlots != null) slots.push(['Memento', card.MementoSlots]);
    if (card.SupportSlots != null) slots.push(['Suporte', card.SupportSlots]);
    if (slots.length > 0) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Slots</div>
        <div class="modal-stats-grid">
          ${slots.map(([label, val]) => `
            <div class="modal-stat">
              <div class="modal-stat-label">${label}</div>
              <div class="modal-stat-value">${val}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Damage & Range
    if (card.Damage && card.Damage.Attribute !== 'None') {
      html += `<div class="modal-section">
        <div class="modal-section-title">Dano</div>
        <div class="modal-stats-grid">
          <div class="modal-stat"><div class="modal-stat-label">Atributo</div><div class="modal-stat-value">${esc(card.Damage.Attribute)}</div></div>
          ${card.Damage.Constant ? `<div class="modal-stat"><div class="modal-stat-label">Constante</div><div class="modal-stat-value">${card.Damage.Constant}</div></div>` : ''}
          ${card.Damage.Dice && card.Damage.Dice !== 'None' ? `<div class="modal-stat"><div class="modal-stat-label">Dado</div><div class="modal-stat-value">${esc(card.Damage.Dice)}</div></div>` : ''}
        </div>
      </div>`;
    }

    // Flavor Text
    if (card.FlavorText) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Texto de Ambientação</div>
        <div class="modal-flavor">${esc(card.FlavorText)}</div>
      </div>`;
    }

    // Artist
    if (card.Artist && card.Artist.trim()) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Artista</div>
        <p style="color:var(--text-secondary);font-weight:500">${esc(card.Artist.trim())}</p>
      </div>`;
    }

    // Share bar
    html += `
      <div class="modal-share-bar">
        <button class="btn-share" aria-label="Compartilhar carta">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
          Compartilhar
        </button>
      </div>
      </div>
      </div>
    `;

    return html;
  }

  function formatEffectText(text) {
    if (!text) return '';
    // Replace custom tags with styled spans
    let formatted = esc(text);
    formatted = formatted.replace(/&lt;e&gt;/gi, '<strong style="color:var(--accent)">');
    formatted = formatted.replace(/&lt;\/e&gt;/gi, '</strong>');
    formatted = formatted.replace(/&lt;i&gt;/gi, '<em>');
    formatted = formatted.replace(/&lt;\/i&gt;/gi, '</em>');
    // Replace {TOKEN} patterns with styled spans
    formatted = formatted.replace(/\{([A-Z_]+)\}/g, '<span style="font-weight:600;color:var(--accent)">$1</span>');
    return formatted;
  }

  // ── Share / Deep Link ─────────────────────
  function shareCard(card, btnEl) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('card', card.Id);
    const shareUrl = url.toString();

    if (navigator.share) {
      navigator.share({
        title: card.Name + ' — Apotheosis Database',
        url: shareUrl,
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        btnEl.classList.add('copied');
        btnEl.innerHTML = `
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          Link copiado!
        `;
        setTimeout(() => {
          btnEl.classList.remove('copied');
          btnEl.innerHTML = `
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
            Compartilhar
          `;
        }, 2000);
      });
    }
  }

  async function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get('card');
    if (!cardId) return;

    // Need to load data first
    if (state.allCards.length === 0) {
      state.isLoading = true;
      showSkeletons();
      try {
        state.allCards = await fetchCards();
        populateFilters(state.allCards);
      } catch (err) {
        showError('Falha ao carregar dados: ' + err.message);
        state.isLoading = false;
        return;
      }
      state.isLoading = false;
    }

    const card = state.allCards.find((c) => c.Id === cardId);
    if (card) {
      // Show all cards in background
      state.hasSearched = true;
      displayCards(applyFilters());
      openModal(card);
    }
  }

  // ── View Mode Toggle ──────────────────────
  function setViewMode(mode) {
    state.viewMode = mode;

    // Update active button
    $$('.view-btn').forEach((btn) => btn.classList.remove('active'));
    if (mode === 'compact') dom.viewCompact.classList.add('active');
    if (mode === 'medium') dom.viewMedium.classList.add('active');
    if (mode === 'large') dom.viewLarge.classList.add('active');

    // Re-render if already displaying cards
    if (state.hasSearched && state.filteredCards.length > 0) {
      displayCards(state.filteredCards);
    }
  }

  // ── Utility ───────────────────────────────
  function esc(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ── Event Bindings ────────────────────────
  function bindEvents() {
    // Search button
    dom.btnSearch.addEventListener('click', performSearch);

    // Enter key in search input
    dom.filterName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch();
    });

    // Retry button
    dom.btnRetry.addEventListener('click', performSearch);

    // Filter/Sort changes trigger re-filter if already searched
    [dom.filterSuit, dom.filterRarity, dom.filterArtist, dom.filterKnowledge, dom.sortBy].forEach((el) => {
      el.addEventListener('change', () => {
        if (state.hasSearched) {
          const results = applyFilters();
          displayCards(results);
        }
      });
    });

    // View mode buttons
    dom.viewCompact.addEventListener('click', () => setViewMode('compact'));
    dom.viewMedium.addEventListener('click', () => setViewMode('medium'));
    dom.viewLarge.addEventListener('click', () => setViewMode('large'));

    // Modal
    dom.modalClose.addEventListener('click', closeModal);
    dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.modalOverlay.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  // ── Init ──────────────────────────────────
  function init() {
    initTheme();
    bindEvents();
    setupScrollObserver();
    preloadData();
    handleDeepLink();
  }

  // ── Auth Gate ──────────────────────────────
  const AUTH_HASH = '674e7be7af2d59b285f39a78c231b2c1b79ca21b9f26c3699d2520c6c3f55b50';
  const AUTH_KEY = 'apotheosis-auth';

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function unlockApp() {
    const gate = document.getElementById('auth-gate');
    const wrapper = document.getElementById('app-wrapper');

    // Fade out gate
    gate.classList.add('auth-gate-hidden');

    // Show app
    wrapper.classList.remove('hidden');

    // Remove gate from DOM after animation
    setTimeout(() => {
      gate.remove();
    }, 600);

    // Now start the app
    init();
  }

  function setupAuthGate() {
    // Check if already authenticated
    if (localStorage.getItem(AUTH_KEY) === 'granted') {
      unlockApp();
      return;
    }

    const form = document.getElementById('auth-form');
    const input = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const password = input.value;
      if (!password) return;

      const hash = await sha256(password);

      if (hash === AUTH_HASH) {
        // Save auth to localStorage
        localStorage.setItem(AUTH_KEY, 'granted');
        input.classList.remove('auth-input-error');
        errorMsg.classList.add('hidden');
        unlockApp();
      } else {
        // Show error
        input.classList.add('auth-input-error');
        errorMsg.classList.remove('hidden');
        input.value = '';
        input.focus();

        // Remove shake animation class after it plays
        setTimeout(() => {
          input.classList.remove('auth-input-error');
        }, 400);
      }
    });
  }

  // Run auth gate
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAuthGate);
  } else {
    setupAuthGate();
  }

})();
