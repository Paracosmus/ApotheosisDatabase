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
    VIRTUAL_BUFFER: 10,
    BATCH_SIZE: 40,
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

  const PRICE_TO_VALUE = {
    1: 1, 2: 5, 3: 10, 4: 20, 5: 25, 6: 50, 7: 75, 8: 100,
    9: 150, 10: 200, 11: 250, 12: 500, 13: 750, 14: 1000,
    15: 2500, 16: 5000, 17: 10000, 18: 25000, 19: 50000, 20: 100000,
  };

  function getPriceValue(price) {
    return PRICE_TO_VALUE[price] || 0;
  }

  // ── Multi-Select Component ────────────────
  class MultiSelect {
    constructor(container, options = {}) {
      this.container = container;
      this.selected = new Set();
      this.options = [];
      this.filteredOptions = [];
      this.isOpen = false;
      this.searchable = options.searchable !== false;
      this.placeholder = container.dataset.placeholder || 'Selecionar...';
      this.onChange = options.onChange || (() => {});
      this._build();
    }

    _build() {
      this.container.classList.add('ms-container');
      this.container.innerHTML = `
        <div class="ms-trigger">
          <div class="ms-chips"></div>
          <span class="ms-placeholder">${esc(this.placeholder)}</span>
          <svg class="ms-arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
        </div>
        <div class="ms-dropdown">
          ${this.searchable ? '<input class="ms-search" type="text" placeholder="Buscar..." autocomplete="off">' : ''}
          <div class="ms-options"></div>
        </div>
      `;

      this.triggerEl = this.container.querySelector('.ms-trigger');
      this.chipsEl = this.container.querySelector('.ms-chips');
      this.placeholderEl = this.container.querySelector('.ms-placeholder');
      this.dropdownEl = this.container.querySelector('.ms-dropdown');
      this.optionsEl = this.container.querySelector('.ms-options');
      this.searchEl = this.container.querySelector('.ms-search');

      this.triggerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });

      if (this.searchEl) {
        this.searchEl.addEventListener('input', () => this._filterOptions());
        this.searchEl.addEventListener('click', (e) => e.stopPropagation());
      }
    }

    setOptions(items) {
      this.options = items.map((item) => typeof item === 'string' ? { value: item, label: item } : item);
      this.filteredOptions = [...this.options];
      this._renderOptions();
    }

    _filterOptions() {
      const q = (this.searchEl?.value || '').toLowerCase();
      this.filteredOptions = q
        ? this.options.filter((o) => o.label.toLowerCase().includes(q))
        : [...this.options];
      this._renderOptions();
    }

    _renderOptions() {
      this.optionsEl.innerHTML = '';
      if (this.filteredOptions.length === 0) {
        this.optionsEl.innerHTML = '<div class="ms-empty">Nenhuma opção</div>';
        return;
      }
      const frag = document.createDocumentFragment();
      for (const opt of this.filteredOptions) {
        const div = document.createElement('div');
        div.className = 'ms-option' + (this.selected.has(opt.value) ? ' ms-option-selected' : '');
        div.dataset.value = opt.value;
        div.innerHTML = `<span class="ms-check">${this.selected.has(opt.value) ? '&#10003;' : ''}</span><span>${esc(opt.label)}</span>`;
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleOption(opt.value);
        });
        frag.appendChild(div);
      }
      this.optionsEl.appendChild(frag);
    }

    _toggleOption(value) {
      if (this.selected.has(value)) {
        this.selected.delete(value);
      } else {
        this.selected.add(value);
      }
      this._renderChips();
      this._renderOptions();
      this.onChange([...this.selected]);
    }

    _renderChips() {
      this.chipsEl.innerHTML = '';
      if (this.selected.size === 0) {
        this.placeholderEl.style.display = '';
        return;
      }
      this.placeholderEl.style.display = 'none';
      const frag = document.createDocumentFragment();
      for (const val of this.selected) {
        const opt = this.options.find((o) => o.value === val);
        if (!opt) continue;
        const chip = document.createElement('span');
        chip.className = 'ms-chip';
        chip.innerHTML = `${esc(opt.label)}<button class="ms-chip-remove" type="button">&times;</button>`;
        chip.querySelector('.ms-chip-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleOption(val);
        });
        frag.appendChild(chip);
      }
      this.chipsEl.appendChild(frag);
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      this.container.classList.add('ms-open');
      if (this.searchEl) {
        this.searchEl.value = '';
        this._filterOptions();
        setTimeout(() => this.searchEl.focus(), 50);
      }
    }

    close() {
      this.isOpen = false;
      this.container.classList.remove('ms-open');
    }

    getValues() {
      return [...this.selected];
    }

    clear() {
      this.selected.clear();
      this._renderChips();
      this._renderOptions();
    }
  }

  // Close all multi-selects on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.ms-container.ms-open').forEach((el) => {
      el.querySelector('.ms-trigger')?.click();
    });
  });

  // ── State ─────────────────────────────────
  const state = {
    allCards: [],
    filteredCards: [],
    renderedCount: 0,
    viewMode: 'compact',
    isLoading: false,
    hasSearched: false,
    dataReady: false,
    multiSelects: {},
    toggleFilters: { coded: null, reviewed: null },
  };

  // ── DOM References ────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    filterName: $('#filter-name'),
    filterWording: $('#filter-wording'),
    filterPriceMin: $('#filter-price-min'),
    filterPriceMax: $('#filter-price-max'),
    sortBy: $('#sort-by'),
    btnSearch: $('#btn-search'),
    btnClearFilters: $('#btn-clear-filters'),
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
  function initMultiSelects() {
    const ids = [
      'ms-suit', 'ms-level', 'ms-rarity', 'ms-knowledge', 'ms-path',
      'ms-craft', 'ms-entity-order', 'ms-companion-type', 'ms-lignumcolor', 'ms-essence',
      'ms-stamina', 'ms-mana', 'ms-lignum', 'ms-tag', 'ms-collection', 'ms-format', 'ms-specifier',
      'ms-equipment-slots', 'ms-memento-slots', 'ms-support-slots', 'ms-inventory-slots',
      'ms-artist', 'ms-style', 'ms-summus',
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        state.multiSelects[id] = new MultiSelect(el, {
          searchable: true,
          onChange: () => { if (state.hasSearched) liveFilter(); },
        });
      }
    }
  }

  function populateFilters(cards) {
    const suits = new Set();
    const levels = new Set();
    const rarities = new Set();
    const knowledges = new Set();
    const paths = new Set();
    const crafts = new Set();
    const entityOrders = new Set();
    const specifiers = new Set();
    const companionTypes = new Set();
    const lignumColors = new Set();
    const essences = new Set();
    const staminas = new Set();
    const manas = new Set();
    const lignums = new Set();
    const tags = new Set();
    const collections = new Set();
    const formats = new Set();
    const equipmentSlots = new Set();
    const mementoSlots = new Set();
    const supportSlots = new Set();
    const inventorySlots = new Set();
    const artists = new Set();
    const summusValues = new Set();

    cards.forEach((card) => {
      if (card.Suit) suits.add(card.Suit);
      if (card.Level != null) levels.add(String(card.Level));
      if (card.Rarity) rarities.add(card.Rarity);
      if (card.Artist && card.Artist.trim()) artists.add(card.Artist.trim());

      // Knowledge
      if (card.Knowledge) knowledges.add(card.Knowledge);
      if (card.Knowledges) card.Knowledges.forEach((k) => knowledges.add(k));
      // "Free Knowledge" for cards that should have knowledge but don't
      const assetSuits = ['Item', 'Skill', 'Companion', 'Event'];
      if (assetSuits.includes(card.Suit)) {
        if (!card.Knowledge && (!card.Knowledges || card.Knowledges.length === 0)) {
          knowledges.add('Free');
        }
      }

      // Path (Class/Companion)
      if (card.Suit === 'Class' || card.Suit === 'Companion') {
        if (card.Path && card.Path !== 'None') {
          paths.add(card.Path);
        } else {
          paths.add('(Sem Caminho)');
        }
      }

      // Crafts
      if (card.Suit === 'Item') {
        if (card.Crafts && card.Crafts.length > 0) {
          card.Crafts.forEach((c) => crafts.add(c));
        } else {
          crafts.add('(Sem Craft)');
        }
      }

      // Specifiers (Item cards)
      if (card.Suit === 'Item') {
        const specs = [];
        if (card.Headpiece) specs.push('Headpiece');
        if (card.Vest) specs.push('Vest');
        if (card.Feet) specs.push('Feet');
        if (card.Accessory) specs.push('Accessory');
        if (card.Utility) specs.push('Utility');
        if (specs.length > 0) {
          specs.forEach((s) => specifiers.add(s));
        } else {
          specifiers.add('(Sem Especificador)');
        }
      }

      // Entity Order
      if (card.Suit === 'Entity') {
        if (card.Order) {
          entityOrders.add(card.Order);
        } else {
          entityOrders.add('(Sem Ordem)');
        }
      }

      // CompanionType
      if (card.CompanionType) companionTypes.add(card.CompanionType);

      // LignumColor
      if (card.LignumColor) lignumColors.add(card.LignumColor);

      // Essence (numeric values)
      if (card.Essence != null) essences.add(String(card.Essence));

      // Stamina & Mana
      if (card.Stamina != null) staminas.add(String(card.Stamina));
      if (card.Mana != null) manas.add(String(card.Mana));

      // Lignum (Skill cards only)
      if (card.Suit === 'Skill' && card.Lignum) lignums.add(card.Lignum);

      // Tags
      if (card.Tags) card.Tags.forEach((t) => tags.add(t));

      // Collection
      if (card.Collection) collections.add(card.Collection);

      // Formats
      if (card.Formats) card.Formats.forEach((f) => formats.add(f));

      // Slots (combine base and bonus variants)
      const eqSlot = card.EquipmentSlots ?? card.EquipmentSlotsBonus;
      if (eqSlot != null) equipmentSlots.add(String(eqSlot));
      const memSlot = card.MementoSlots ?? card.MementoSlotsBonus;
      if (memSlot != null) mementoSlots.add(String(memSlot));
      const supSlot = card.SupportSlots ?? card.SupportSlotsBonus;
      if (supSlot != null) supportSlots.add(String(supSlot));
      const invSlot = card.InventorySlots ?? card.InventorySlotsBonus;
      if (invSlot != null) inventorySlots.add(String(invSlot));

      // Summus
      if (card.Summus) summusValues.add(card.Summus);
    });

    const ms = state.multiSelects;

    ms['ms-suit']?.setOptions(sortByOrder([...suits], SUIT_ORDER));
    ms['ms-level']?.setOptions([...levels].sort((a, b) => Number(a) - Number(b)));
    ms['ms-rarity']?.setOptions(sortByOrder([...rarities], RARITY_ORDER));
    ms['ms-knowledge']?.setOptions([...knowledges].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-path']?.setOptions([...paths].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-craft']?.setOptions([...crafts].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-entity-order']?.setOptions([...entityOrders].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-companion-type']?.setOptions([...companionTypes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-lignumcolor']?.setOptions([...lignumColors].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-essence']?.setOptions([...essences].sort((a, b) => Number(a) - Number(b)));
    ms['ms-stamina']?.setOptions([...staminas].sort((a, b) => Number(a) - Number(b)));
    ms['ms-mana']?.setOptions([...manas].sort((a, b) => Number(a) - Number(b)));
    ms['ms-lignum']?.setOptions([...lignums].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-tag']?.setOptions([...tags].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-collection']?.setOptions([...collections].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-format']?.setOptions([...formats].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-specifier']?.setOptions([...specifiers].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-equipment-slots']?.setOptions([...equipmentSlots].sort((a, b) => Number(a) - Number(b)));
    ms['ms-memento-slots']?.setOptions([...mementoSlots].sort((a, b) => Number(a) - Number(b)));
    ms['ms-support-slots']?.setOptions([...supportSlots].sort((a, b) => Number(a) - Number(b)));
    ms['ms-inventory-slots']?.setOptions([...inventorySlots].sort((a, b) => Number(a) - Number(b)));
    ms['ms-artist']?.setOptions([...artists].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    ms['ms-style']?.setOptions([
      { value: 'normal', label: 'Normal' },
      { value: 'full-art', label: 'Full-Art' },
      { value: 'animated', label: 'Animated' },
    ]);
    ms['ms-summus']?.setOptions([...summusValues].sort().map((v) => ({ value: v, label: formatSummusLabel(v) })));
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

  function formatSummusLabel(value) {
    if (!value) return '';
    return value.replace(/^Summus/, '').replace(/_C$/, '');
  }

  // ── Filtering & Sorting ───────────────────
  function getCardTextContent(card) {
    let text = '';
    if (card.Effects) {
      card.Effects.forEach((e) => {
        if (e.Text) text += ' ' + e.Text;
        if (e.Keywords) text += ' ' + e.Keywords;
        if (e.Name) text += ' ' + e.Name;
      });
    }
    if (card.Techniques) {
      card.Techniques.forEach((t) => {
        if (t.Effects) t.Effects.forEach((e) => {
          if (e.Text) text += ' ' + e.Text;
        });
      });
    }
    if (card.FlavorText) text += ' ' + card.FlavorText;
    if (card.SummusData) {
      const sd = card.SummusData;
      if (sd.text) text += ' ' + sd.text;
      if (sd.Text) text += ' ' + sd.Text;
      if (sd.condition) text += ' ' + sd.condition;
    }
    return text.toLowerCase();
  }

  function applyFilters() {
    const nameQuery = dom.filterName.value.trim().toLowerCase();
    const wordingQuery = dom.filterWording.value.trim().toLowerCase();
    const priceMin = dom.filterPriceMin.value !== '' ? Number(dom.filterPriceMin.value) : null;
    const priceMax = dom.filterPriceMax.value !== '' ? Number(dom.filterPriceMax.value) : null;

    const ms = state.multiSelects;
    const suitVals = ms['ms-suit']?.getValues() || [];
    const levelVals = ms['ms-level']?.getValues() || [];
    const rarityVals = ms['ms-rarity']?.getValues() || [];
    const knowledgeVals = ms['ms-knowledge']?.getValues() || [];
    const pathVals = ms['ms-path']?.getValues() || [];
    const craftVals = ms['ms-craft']?.getValues() || [];
    const entityOrderVals = ms['ms-entity-order']?.getValues() || [];
    const companionTypeVals = ms['ms-companion-type']?.getValues() || [];
    const lignumColorVals = ms['ms-lignumcolor']?.getValues() || [];
    const essenceVals = ms['ms-essence']?.getValues() || [];
    const staminaVals = ms['ms-stamina']?.getValues() || [];
    const manaVals = ms['ms-mana']?.getValues() || [];
    const lignumVals = ms['ms-lignum']?.getValues() || [];
    const tagVals = ms['ms-tag']?.getValues() || [];
    const collectionVals = ms['ms-collection']?.getValues() || [];
    const formatVals = ms['ms-format']?.getValues() || [];
    const specifierVals = ms['ms-specifier']?.getValues() || [];
    const equipmentSlotsVals = ms['ms-equipment-slots']?.getValues() || [];
    const mementoSlotsVals = ms['ms-memento-slots']?.getValues() || [];
    const supportSlotsVals = ms['ms-support-slots']?.getValues() || [];
    const inventorySlotsVals = ms['ms-inventory-slots']?.getValues() || [];
    const artistVals = ms['ms-artist']?.getValues() || [];
    const styleVals = ms['ms-style']?.getValues() || [];
    const summusVals = ms['ms-summus']?.getValues() || [];
    const codedFilter = state.toggleFilters.coded;
    const reviewedFilter = state.toggleFilters.reviewed;

    let results = state.allCards.filter((card) => {
      // Name
      if (nameQuery && !card.Name.toLowerCase().includes(nameQuery) && !card.Id.toLowerCase().includes(nameQuery)) return false;

      // Wording
      if (wordingQuery && !getCardTextContent(card).includes(wordingQuery)) return false;

      // Suit
      if (suitVals.length > 0 && !suitVals.includes(card.Suit)) return false;

      // Level
      if (levelVals.length > 0 && !levelVals.includes(String(card.Level))) return false;

      // Rarity
      if (rarityVals.length > 0 && !rarityVals.includes(card.Rarity)) return false;

      // Knowledge
      if (knowledgeVals.length > 0) {
        const cardKnowledges = new Set();
        if (card.Knowledge) cardKnowledges.add(card.Knowledge);
        if (card.Knowledges) card.Knowledges.forEach((k) => cardKnowledges.add(k));
        const assetSuits = ['Item', 'Skill', 'Companion', 'Event'];
        if (assetSuits.includes(card.Suit) && cardKnowledges.size === 0) {
          cardKnowledges.add('Free');
        }
        if (!knowledgeVals.some((v) => cardKnowledges.has(v))) return false;
      }

      // Path
      if (pathVals.length > 0) {
        if (card.Suit !== 'Class' && card.Suit !== 'Companion') return false;
        const cardPath = (card.Path && card.Path !== 'None') ? card.Path : '(Sem Caminho)';
        if (!pathVals.includes(cardPath)) return false;
      }

      // Craft
      if (craftVals.length > 0) {
        if (card.Suit !== 'Item') return false;
        const cardCrafts = (card.Crafts && card.Crafts.length > 0) ? [...new Set(card.Crafts)] : ['(Sem Craft)'];
        if (!craftVals.some((v) => cardCrafts.includes(v))) return false;
      }

      // Specifier
      if (specifierVals.length > 0) {
        if (card.Suit !== 'Item') return false;
        const cardSpecs = [];
        if (card.Headpiece) cardSpecs.push('Headpiece');
        if (card.Vest) cardSpecs.push('Vest');
        if (card.Feet) cardSpecs.push('Feet');
        if (card.Accessory) cardSpecs.push('Accessory');
        if (card.Utility) cardSpecs.push('Utility');
        if (cardSpecs.length === 0) cardSpecs.push('(Sem Especificador)');
        if (!specifierVals.some((v) => cardSpecs.includes(v))) return false;
      }

      // Entity Order
      if (entityOrderVals.length > 0) {
        if (card.Suit !== 'Entity') return false;
        const cardOrder = card.Order || '(Sem Ordem)';
        if (!entityOrderVals.includes(cardOrder)) return false;
      }

      // Equipment Slots
      if (equipmentSlotsVals.length > 0) {
        const v = card.EquipmentSlots ?? card.EquipmentSlotsBonus;
        if (v == null) return false;
        if (!equipmentSlotsVals.includes(String(v))) return false;
      }

      // Memento Slots
      if (mementoSlotsVals.length > 0) {
        const v = card.MementoSlots ?? card.MementoSlotsBonus;
        if (v == null) return false;
        if (!mementoSlotsVals.includes(String(v))) return false;
      }

      // Support Slots
      if (supportSlotsVals.length > 0) {
        const v = card.SupportSlots ?? card.SupportSlotsBonus;
        if (v == null) return false;
        if (!supportSlotsVals.includes(String(v))) return false;
      }

      // Inventory Slots
      if (inventorySlotsVals.length > 0) {
        const v = card.InventorySlots ?? card.InventorySlotsBonus;
        if (v == null) return false;
        if (!inventorySlotsVals.includes(String(v))) return false;
      }

      // CompanionType
      if (companionTypeVals.length > 0) {
        if (!companionTypeVals.includes(card.CompanionType)) return false;
      }

      // LignumColor
      if (lignumColorVals.length > 0) {
        if (!card.LignumColor || !lignumColorVals.includes(card.LignumColor)) return false;
      }

      // Essence
      if (essenceVals.length > 0) {
        if (card.Essence == null) return false;
        if (!essenceVals.includes(String(card.Essence))) return false;
      }

      // Stamina
      if (staminaVals.length > 0) {
        if (card.Stamina == null) return false;
        if (!staminaVals.includes(String(card.Stamina))) return false;
      }

      // Mana
      if (manaVals.length > 0) {
        if (card.Mana == null) return false;
        if (!manaVals.includes(String(card.Mana))) return false;
      }

      // Lignum
      if (lignumVals.length > 0) {
        if (card.Suit !== 'Skill' || !card.Lignum) return false;
        if (!lignumVals.includes(card.Lignum)) return false;
      }

      // Tag
      if (tagVals.length > 0) {
        if (!card.Tags || !tagVals.some((v) => card.Tags.includes(v))) return false;
      }

      // Collection
      if (collectionVals.length > 0) {
        if (!card.Collection || !collectionVals.includes(card.Collection)) return false;
      }

      // Formats
      if (formatVals.length > 0) {
        if (!card.Formats || !formatVals.some((v) => card.Formats.includes(v))) return false;
      }

      // Artist
      if (artistVals.length > 0) {
        if (!artistVals.includes((card.Artist || '').trim())) return false;
      }

      // Style (Normal / Full-Art / Animated)
      if (styleVals.length > 0) {
        const cardStyles = [];
        if (card.FullArt) cardStyles.push('full-art');
        if (card.Media) cardStyles.push('animated');
        if (!card.FullArt && !card.Media) cardStyles.push('normal');
        if (!styleVals.some((v) => cardStyles.includes(v))) return false;
      }

      // Summus
      if (summusVals.length > 0) {
        if (!card.Summus) return false;
        if (!summusVals.includes(card.Summus)) return false;
      }

      // Price (compare against converted display value)
      if (priceMin !== null || priceMax !== null) {
        if (card.Price == null) return false;
        const displayPrice = getPriceValue(card.Price);
        if (priceMin !== null && displayPrice < priceMin) return false;
        if (priceMax !== null && displayPrice > priceMax) return false;
      }

      // Coded
      if (codedFilter !== null) {
        if (card.Coded !== codedFilter) return false;
      }

      // Reviewed
      if (reviewedFilter !== null) {
        if (card.Reviewed !== reviewedFilter) return false;
      }

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

    // Summus & SummusData
    if (card.Summus) {
      html += `<div class="modal-section">
        <div class="modal-section-title">Summus</div>
        <p style="color:var(--text-secondary);font-weight:500">${esc(formatSummusLabel(card.Summus))}</p>
      </div>`;

      const sd = card.SummusData;
      if (sd && Object.keys(sd).length > 0) {
        const dataEntries = [];
        if (sd.timer != null) dataEntries.push(['Timer', sd.timer]);
        if (sd.hp != null) dataEntries.push(['HP', sd.hp]);
        if (sd.area != null) dataEntries.push(['Área', sd.area]);
        if (sd.condition) dataEntries.push(['Condição', formatEffectText(sd.condition)]);
        const sdText = sd.text || sd.Text;
        if (sdText) dataEntries.push(['Texto', formatEffectText(sdText)]);

        if (dataEntries.length > 0) {
          html += `<div class="modal-section">
            <div class="modal-section-title">Summus Data</div>
            <div class="modal-summus-data">
              ${dataEntries.map(([label, val]) => `
                <div class="modal-summus-entry">
                  <span class="modal-summus-label">${label}:</span>
                  <span class="modal-summus-value">${val}</span>
                </div>
              `).join('')}
            </div>
          </div>`;
        }
      }
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

    // Enter key in search inputs
    dom.filterName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch();
    });
    dom.filterWording.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch();
    });

    // Retry button
    dom.btnRetry.addEventListener('click', performSearch);

    // Live filter on sort change
    dom.sortBy.addEventListener('change', () => {
      if (state.hasSearched) liveFilter();
    });

    // Live filter on text input (debounced)
    let debounceTimer;
    const debouncedFilter = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (state.hasSearched) liveFilter();
      }, 300);
    };
    dom.filterName.addEventListener('input', debouncedFilter);
    dom.filterWording.addEventListener('input', debouncedFilter);
    dom.filterPriceMin.addEventListener('input', debouncedFilter);
    dom.filterPriceMax.addEventListener('input', debouncedFilter);

    // Toggle buttons (Coded / Reviewed)
    document.querySelectorAll('.toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const value = btn.dataset.value === 'true';
        const isActive = btn.classList.contains('toggle-active');

        // Deselect all in this group
        btn.parentElement.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('toggle-active'));

        if (isActive) {
          state.toggleFilters[filter] = null;
        } else {
          btn.classList.add('toggle-active');
          state.toggleFilters[filter] = value;
        }

        if (state.hasSearched) liveFilter();
      });
    });

    // Clear all filters
    dom.btnClearFilters.addEventListener('click', clearAllFilters);

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

  function liveFilter() {
    const results = applyFilters();
    displayCards(results);
  }

  function clearAllFilters() {
    dom.filterName.value = '';
    dom.filterWording.value = '';
    dom.filterPriceMin.value = '';
    dom.filterPriceMax.value = '';

    Object.values(state.multiSelects).forEach((ms) => ms.clear());

    state.toggleFilters.coded = null;
    state.toggleFilters.reviewed = null;
    document.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('toggle-active'));

    if (state.hasSearched) liveFilter();
  }

  // ── Init ──────────────────────────────────
  function init() {
    initTheme();
    initMultiSelects();
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
