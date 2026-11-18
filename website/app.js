/**
 * L'ORÉAL CAPITOL — MAISON HAUTE COUTURE (YAOUNDÉ)
 * Noir & Or Design System inspiré de Zegna Haute Confection
 * Intégration en temps réel Firebase, Store Locator Yaoundé, GPS en Direct,
 * Grille 2 colonnes sans bordures blanches, Zoom photos & Réservation WhatsApp
 */

(function () {
  'use strict';

  // --- COORDONNÉES OFFICIELLES & BACKEND FIREBASE ---
  const CLOUD_PRODUCTS_URL = 'https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json';
  const CLOUD_ADVANCES_URL = 'https://l-oreal-capitol-default-rtdb.firebaseio.com/advances.json';
  const CLOUD_PHOTOS_URL = 'https://l-oreal-capitol-default-rtdb.firebaseio.com/model_photos.json';

  const SHOWROOMS = {
    falaise: {
      name: "L'Oréal Capitol — La Falaise (Yaoundé)",
      shortName: 'La Falaise (Yaoundé)',
      phone: '(+237) 699 94 20 24 / 694 38 95 84',
      waNumber: '237699942024',
      email: 'lorealcapitol@gmail.com',
      address: 'VGC8+58F, Yaoundé, Cameroun',
      gpsDestination: 'VGC8+58F, Yaoundé, Cameroun'
    },
    tougou: {
      name: "L'Oréal Capitol — Tougou (Yaoundé)",
      shortName: 'Tougou (Yaoundé)',
      phone: '(+237) 670 37 18 20',
      waNumber: '237670371820',
      address: 'VGJF+W8C, Rue Onembele Nkou, Yaoundé, Cameroun',
      gpsDestination: 'VGJF+W8C, Rue Onembele Nkou, Yaoundé, Cameroun'
    }
  };

  const OFFICIAL_CATEGORIES = [
    'Costume',
    'Costume Soirée',
    'Albacost',
    'Chaussure Homme',
    'Chaussure Femme',
    'Vêtement Homme',
    'Vêtement Femme',
    'Chemise',
    'Veste',
    'Boubou',
    'Pantalon',
    'Cravate',
    'Chaussette',
    'Lunette',
    'Ceinture',
    'Sac Homme',
    'Sac Femme',
    'Autre'
  ];

  // --- PALETTE DE COULEURS OFFICIELLES & SWATCHES ZEGNA NOIR & OR ---
  const SPECIAL_PALETTES = {
    'Noir': { hex: '#141416', border: '#3A3A40', text: '#FFFFFF' },
    'Bleu Nuit': { hex: '#0B1526', gradient: 'linear-gradient(135deg, #070D18, #132238)', border: '#1E3250', text: '#FFFFFF' },
    'Bleu Ciel': { hex: '#7EC8E3', gradient: 'linear-gradient(135deg, #7EC8E3, #A5DCF0)', border: '#60A5FA', text: '#0D233A' },
    'Bleu': { hex: '#1D4ED8', gradient: 'linear-gradient(135deg, #1E40AF, #2563EB)', border: '#3B82F6', text: '#FFFFFF' },
    'Bleu Crocco': { hex: '#0D274A', gradient: 'linear-gradient(135deg, #08172E 0%, #173866 50%, #0E223D 100%)', border: '#2563EB', text: '#FFFFFF' },
    'Noir Crocco': { hex: '#111215', gradient: 'linear-gradient(135deg, #090A0D 0%, #202227 50%, #111215 100%)', border: '#3F3F46', text: '#FFFFFF' },
    'Marron Daim': { hex: '#6E4726', gradient: 'linear-gradient(135deg, #6E4726, #8B5A2B)', border: '#A06E3B', text: '#FFFFFF' },
    'Marron': { hex: '#4A2A18', gradient: 'linear-gradient(135deg, #3D2213, #5C341E)', border: '#784323', text: '#FFFFFF' },
    'Cognac': { hex: '#9A4B1A', gradient: 'linear-gradient(135deg, #9A4B1A, #B45F28)', border: '#D97736', text: '#FFFFFF' },
    'Bordeaux': { hex: '#58111A', gradient: 'linear-gradient(135deg, #420D13, #6B1722)', border: '#801B28', text: '#FFFFFF' },
    'Blanc': { hex: '#F8F9FA', gradient: 'linear-gradient(135deg, #FFFFFF, #E4E5E8)', border: '#D4AF37', text: '#111111' },
    'Gris': { hex: '#5A5D64', gradient: 'linear-gradient(135deg, #4B4D52, #6B6F77)', border: '#7A7E88', text: '#FFFFFF' },
    'Jaune': { hex: '#E5B824', gradient: 'linear-gradient(135deg, #E5B824, #F5CF47)', border: '#FBBF24', text: '#1F1B00' },
    'Vert': { hex: '#1E3F29', gradient: 'linear-gradient(135deg, #152E1D, #275235)', border: '#2E5D3D', text: '#FFFFFF' },
    'Vert Bouteille': { hex: '#0E2818', gradient: 'linear-gradient(135deg, #091C10, #143822)', border: '#1F5434', text: '#FFFFFF' },
    'Rouge': { hex: '#9E1B22', gradient: 'linear-gradient(135deg, #82141A, #B8222B)', border: '#C22A33', text: '#FFFFFF' },
    'Beige': { hex: '#D7C4A8', gradient: 'linear-gradient(135deg, #CBB493, #E4D5BE)', border: '#D4AF37', text: '#222222' },
    'Orange': { hex: '#C85A17', gradient: 'linear-gradient(135deg, #B54D0F, #DB6723)', border: '#EA6C24', text: '#FFFFFF' },
    'Violet': { hex: '#4C1D6E', gradient: 'linear-gradient(135deg, #3B1656, #5F258B)', border: '#6E2D9B', text: '#FFFFFF' },
    'Rose': { hex: '#D15887', gradient: 'linear-gradient(135deg, #BC4976, #E06C9B)', border: '#E276A0', text: '#FFFFFF' },
    'Doré': { hex: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #AA7C1E)', border: '#F3E5AB', text: '#000000' },
    'Argenté': { hex: '#A8A9AD', gradient: 'linear-gradient(135deg, #D9D9DC, #8E8F94)', border: '#FFFFFF', text: '#000000' }
  };

  const COLOR_PALETTE = SPECIAL_PALETTES;

  function getColorPalette(colorName) {
    if (!colorName) return SPECIAL_PALETTES['Noir'];
    if (SPECIAL_PALETTES[colorName]) return SPECIAL_PALETTES[colorName];

    const c = colorName.toLowerCase();
    if (c.includes('crocco') || c.includes('croco')) {
      if (c.includes('bleu')) return SPECIAL_PALETTES['Bleu Crocco'];
      if (c.includes('noir')) return SPECIAL_PALETTES['Noir Crocco'];
    }
    if (c.includes('bleu')) {
      if (c.includes('nuit') || c.includes('marine')) return SPECIAL_PALETTES['Bleu Nuit'];
      if (c.includes('ciel') || c.includes('clair')) return SPECIAL_PALETTES['Bleu Ciel'];
      return SPECIAL_PALETTES['Bleu'];
    }
    if (c.includes('vert')) return SPECIAL_PALETTES['Vert'];
    if (c.includes('marron')) return SPECIAL_PALETTES['Marron'];
    if (c.includes('noir')) return SPECIAL_PALETTES['Noir'];
    if (c.includes('blanc')) return SPECIAL_PALETTES['Blanc'];
    if (c.includes('rouge')) return SPECIAL_PALETTES['Rouge'];
    if (c.includes('jaune')) return SPECIAL_PALETTES['Jaune'];
    if (c.includes('beige')) return SPECIAL_PALETTES['Beige'];
    if (c.includes('gris')) return SPECIAL_PALETTES['Gris'];
    if (c.includes('bordeaux')) return SPECIAL_PALETTES['Bordeaux'];

    let hash = 0;
    for (let i = 0; i < colorName.length; i++) {
      hash = colorName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return {
      hex: `hsl(${h}, 45%, 25%)`,
      gradient: `linear-gradient(135deg, hsl(${h}, 50%, 18%), hsl(${h}, 50%, 32%))`,
      border: `hsl(${h}, 60%, 45%)`,
      text: '#FFFFFF'
    };
  }

  function toTitleCase(str) {
    if (!str) return '';
    return str
      .trim()
      .split(/\s+/)
      .map(word => {
        if (!word) return '';
        return word.split('-').map(part => {
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join('-');
      })
      .join(' ');
  }

  function normalizeColor(rawColor) {
    if (!rawColor) return 'Noir';
    const c = String(rawColor).toLowerCase().replace(/[\-_/\\,.]/g, ' ').replace(/\s+/g, ' ').trim();

    // Règle explicite utilisateur : marron din / din marron / daim marron / marron daim -> Marron Daim combiné
    if (
      c === 'din marron' || c === 'marron din' || 
      c === 'daim marron' || c === 'marron daim' || 
      c === 'dain marron' || c === 'marron dain'
    ) {
      return 'Marron Daim';
    }

    if (c === 'bleunuit' || c === 'bleu nuit') {
      return 'Bleu Nuit';
    }

    if (c === 'bleuciel' || c === 'bleu ciel') {
      return 'Bleu Ciel';
    }

    // Règle formelle utilisateur : Ne jamais unifier les teintes distinctes (ex: "Bleu Crocco" et "Bleu")
    return toTitleCase(rawColor);
  }

  function safePhotoKey(key) {
    return String(key || '').replace(/[.#$[\]/]/g, '_');
  }

  function cssEscape(val) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(val);
    }
    return String(val || '').replace(/["\\]/g, '\\$&');
  }

  function getModelColorPhoto(modelKey, colorName) {
    if (colorName) {
      const specificKey = `${modelKey}___${colorName}`;
      const safeSpec = safePhotoKey(specificKey);
      if (state.modelPhotos[specificKey]) return state.modelPhotos[specificKey];
      if (state.modelPhotos[safeSpec]) return state.modelPhotos[safeSpec];
    }
    const safeMain = safePhotoKey(modelKey);
    return state.modelPhotos[modelKey] || state.modelPhotos[safeMain] || null;
  }

  // --- ÉTAT GLOBAL DE L'APPLICATION ---
  const state = {
    groupedModels: [],
    filteredModels: [],
    modelPhotos: {},
    activeGender: 'all',    // 'all' | 'homme' | 'femme'
    activeStore: 'all',     // 'all' | 'falaise' | 'tougou'
    activeCategory: 'all',
    activeSize: 'all',
    searchQuery: '',
    page: 1,
    pageSize: 24,
    selectedModel: null,
    targetPhotoModelKey: null,
    targetPhotoColor: null,
    selectedModalColor: null,
    currentZoomScale: 1
  };

  // --- SÉLECTEURS DU DOM ---
  const el = {
    introSplash: document.getElementById('introSplash'),
    cursorGlow: document.getElementById('cursorGlow'),
    mainHeader: document.getElementById('mainHeader'),
    mainNav: document.getElementById('mainNav'),
    activeShowroomLabel: document.getElementById('activeShowroomLabel'),
    // Overlays Zegna
    uiBackdrop: document.getElementById('uiBackdrop'),
    cartDrawer: document.getElementById('cartDrawer'),
    searchOverlay: document.getElementById('searchOverlay'),
    regionModal: document.getElementById('regionModal'),
    zegnaSearchInput: document.getElementById('zegnaSearchInput'),
    openSearchBtn: document.getElementById('openSearchBtn'),
    closeSearchOverlayBtn: document.getElementById('closeSearchOverlayBtn'),
    openCartBtn: document.getElementById('openCartBtn'),
    closeCartBtn: document.getElementById('closeCartBtn'),
    closeRegionBtn: document.getElementById('closeRegionBtn'),
    // Catalogue
    activeFilterBadge: document.getElementById('activeFilterBadge'),
    resultsCount: document.getElementById('resultsCount'),
    productsGrid: document.getElementById('productsGrid'),
    paginationWrapper: document.getElementById('paginationWrapper'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    categorySelect: document.getElementById('categorySelect'),
    sizeSelect: document.getElementById('sizeSelect'),
    storeSelect: document.getElementById('storeSelect'),
    // Modal Détail
    productModal: document.getElementById('productModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalPhotoFrame: document.getElementById('modalPhotoFrame'),
    modalStoreBadge: document.getElementById('modalStoreBadge'),
    modalCategory: document.getElementById('modalCategory'),
    modalTitle: document.getElementById('modalTitle'),
    modalPrice: document.getElementById('modalPrice'),
    modalStockStatus: document.getElementById('modalStockStatus'),
    modalStockText: document.getElementById('modalStockText'),
    modalRef: document.getElementById('modalRef'),
    modalUnits: document.getElementById('modalUnits'),
    modalSizesList: document.getElementById('modalSizesList'),
    modalColorsList: document.getElementById('modalColorsList'),
    modalSwatchesContainer: document.getElementById('modalSwatchesContainer'),
    modalSizesChips: document.getElementById('modalSizesChips'),
    modalStoreName: document.getElementById('modalStoreName'),
    modalPhotoUploadBtn: document.getElementById('modalPhotoUploadBtn'),
    modalWaBtn: document.getElementById('modalWaBtn'),
    // Zoom Modal
    imageZoomModal: document.getElementById('imageZoomModal'),
    zoomActiveImg: document.getElementById('zoomActiveImg'),
    zoomCaptionTitle: document.getElementById('zoomCaptionTitle'),
    zoomCaptionRef: document.getElementById('zoomCaptionRef'),
    // Photo Action Modal
    photoActionModal: document.getElementById('photoActionModal'),
    photoTargetTitle: document.getElementById('photoTargetTitle'),
    photoTargetRef: document.getElementById('photoTargetRef'),
    btnSnapPhoto: document.getElementById('btnSnapPhoto'),
    btnPickGallery: document.getElementById('btnPickGallery'),
    btnCancelPhoto: document.getElementById('btnCancelPhoto'),
    cameraInput: document.getElementById('cameraInput'),
    galleryInput: document.getElementById('galleryInput'),
    // Store Locator
    locatorSearchInput: document.getElementById('locatorSearchInput'),
    clearLocSearchBtn: document.getElementById('clearLocSearchBtn'),
    locTabAll: document.getElementById('locTabAll'),
    locTabFalaise: document.getElementById('locTabFalaise'),
    locTabTougou: document.getElementById('locTabTougou'),
    cardStoreFalaise: document.getElementById('cardStoreFalaise'),
    cardStoreTougou: document.getElementById('cardStoreTougou'),
    // Curseur Or & Remontée automatique
    cursorDot: document.getElementById('cursorDot'),
    cursorFollower: document.getElementById('cursorFollower'),
    scrollTopBtn: document.getElementById('scrollTopBtn'),
    // Newsletter
    newsletterForm: document.getElementById('newsletterForm')
  };

  // --- INITIALISATION AU CHARGEMENT ---
  window.addEventListener('DOMContentLoaded', () => {
    initIntroSplash();
    initGoldCursor();
    initZegnaHeaderScroll();
    initZegnaOverlays();
    initMobileBurgerMenu();
    initPhotoInputs();
    initEventHandlers();
    initNewsletter();
    initIntersectionReveal();
    loadCachedPhotos();
    loadCachedCatalog();
    loadCatalogData();

    // Synchronisation discrète en arrière-plan toutes les 25 secondes
    setInterval(() => {
      loadCatalogData(true);
    }, 25000);
  });

  // ==========================================================================
  // 1. TRANSITION D'ENTRÉE CINÉMATIQUE (SPLASH SCREEN LOGO ZOOM)
  // ==========================================================================
  function initIntroSplash() {
    if (!el.introSplash) return;
    setTimeout(() => {
      dismissIntroSplash();
    }, 1800);

    el.introSplash.addEventListener('click', () => {
      dismissIntroSplash();
    });
  }

  function dismissIntroSplash() {
    if (!el.introSplash) return;
    el.introSplash.classList.add('fade-out');
    setTimeout(() => {
      el.introSplash.style.display = 'none';
    }, 650);
  }

  // ==========================================================================
  // CURSEUR OR HAUTE COUTURE SUR PC (DESKTOP)
  // ==========================================================================
  function initGoldCursor() {
    let isTouch = false;
    try {
      isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.matchMedia('(hover: none), (pointer: coarse)').matches;
    } catch (e) {
      isTouch = ('ontouchstart' in window);
    }
    if (isTouch) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let followerX = mouseX;
    let followerY = mouseY;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (el.cursorDot) {
        el.cursorDot.style.left = `${mouseX}px`;
        el.cursorDot.style.top = `${mouseY}px`;
      }
      if (el.cursorGlow) {
        el.cursorGlow.style.left = `${mouseX}px`;
        el.cursorGlow.style.top = `${mouseY}px`;
      }
    }, { passive: true });

    // Anneau doré suiveur fluide
    function renderFollower() {
      followerX += (mouseX - followerX) * 0.18;
      followerY += (mouseY - followerY) * 0.18;

      if (el.cursorFollower) {
        el.cursorFollower.style.left = `${followerX}px`;
        el.cursorFollower.style.top = `${followerY}px`;
      }

      requestAnimationFrame(renderFollower);
    }
    requestAnimationFrame(renderFollower);

    // Effet d'expansion du curseur doré au survol des éléments interactifs
    const hoverTargets = 'a, button, [role="button"], .product-card, .service-card, .product-photo-frame, .locator-tab-btn, .store-gps-btn, .store-wa-reserve-btn, .pill-tab, select, input, .search-suggestions span, .scroll-top-btn, .footer-back-to-top';

    document.addEventListener('mouseover', (e) => {
      if (e.target && e.target.closest(hoverTargets)) {
        if (el.cursorFollower) el.cursorFollower.classList.add('is-hovering');
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target && e.target.closest(hoverTargets)) {
        if (el.cursorFollower) el.cursorFollower.classList.remove('is-hovering');
      }
    });
  }

  // ==========================================================================
  // 2. HEADER INTELLIGENT & BOUTON DE REMONTÉE AUTOMATIQUE
  // ==========================================================================
  function initZegnaHeaderScroll() {
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;

      // Header ombre & fond au défilement
      if (el.mainHeader) {
        if (currentScrollY > 50) {
          el.mainHeader.classList.add('header-scrolled');
        } else {
          el.mainHeader.classList.remove('header-scrolled');
        }

        if (currentScrollY > lastScrollY && currentScrollY > 180) {
          el.mainHeader.classList.add('header-hidden');
        } else {
          el.mainHeader.classList.remove('header-hidden');
        }
      }

      // Bouton flottant de remontée automatique (apparaît au-delà de 320px)
      if (el.scrollTopBtn) {
        if (currentScrollY > 320) {
          el.scrollTopBtn.classList.add('visible');
        } else {
          el.scrollTopBtn.classList.remove('visible');
        }
      }

      lastScrollY = currentScrollY;
    }, { passive: true });
  }

  // ==========================================================================
  // 3. OVERLAYS ZEGNA (BACKDROP, TIROIR PANIER, RECHERCHE, MODALE PAYS)
  // ==========================================================================
  function initZegnaOverlays() {
    // Utilitaires de fermeture
    window.closeAllOverlays = function () {
      if (el.uiBackdrop) el.uiBackdrop.classList.remove('active');
      if (el.cartDrawer) el.cartDrawer.classList.remove('active');
      if (el.searchOverlay) el.searchOverlay.classList.remove('active');
      if (el.regionModal) el.regionModal.classList.remove('active');
    };

    if (el.uiBackdrop) {
      el.uiBackdrop.addEventListener('click', window.closeAllOverlays);
    }
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', window.closeAllOverlays);
    });

    // Ouverture Recherche
    if (el.openSearchBtn) {
      el.openSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.closeAllOverlays();
        if (el.uiBackdrop) el.uiBackdrop.classList.add('active');
        if (el.searchOverlay) el.searchOverlay.classList.add('active');
        setTimeout(() => {
          if (el.zegnaSearchInput) el.zegnaSearchInput.focus();
        }, 120);
      });
    }

    if (el.closeSearchOverlayBtn) {
      el.closeSearchOverlayBtn.addEventListener('click', window.closeAllOverlays);
    }

    // Input recherche Zegna
    if (el.zegnaSearchInput) {
      el.zegnaSearchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        state.searchQuery = val;
        if (el.searchInput) el.searchInput.value = val;
        if (el.clearSearchBtn) el.clearSearchBtn.classList.toggle('visible', !!val);
        applyFilters();
      });

      el.zegnaSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          window.closeAllOverlays();
          window.scrollToCatalogSection();
        }
      });
    }

    // Suggestions de recherche
    window.applyQuickSearch = function (term) {
      if (el.zegnaSearchInput) el.zegnaSearchInput.value = term;
      if (el.searchInput) el.searchInput.value = term;
      state.searchQuery = term;
      if (el.clearSearchBtn) el.clearSearchBtn.classList.add('visible');
      window.closeAllOverlays();
      window.scrollToCatalogSection();
      applyFilters();
    };

    // Ouverture Panier / Réservations
    if (el.openCartBtn) {
      el.openCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.closeAllOverlays();
        if (el.uiBackdrop) el.uiBackdrop.classList.add('active');
        if (el.cartDrawer) el.cartDrawer.classList.add('active');
      });
    }

    if (el.closeCartBtn) {
      el.closeCartBtn.addEventListener('click', window.closeAllOverlays);
    }

    // Ouverture Région / Showroom
    window.openRegionModal = function (e) {
      if (e) e.preventDefault();
      window.closeAllOverlays();
      if (el.uiBackdrop) el.uiBackdrop.classList.add('active');
      if (el.regionModal) el.regionModal.classList.add('active');
    };

    if (el.closeRegionBtn) {
      el.closeRegionBtn.addEventListener('click', window.closeAllOverlays);
    }

    window.selectShowroomAndClose = function (storeKey) {
      state.activeStore = storeKey;
      if (el.storeSelect) el.storeSelect.value = storeKey;

      if (el.activeShowroomLabel) {
        el.activeShowroomLabel.textContent = storeKey === 'tougou' 
          ? 'YAOUNDÉ - TOUGOU' 
          : 'YAOUNDÉ - LA FALAISE';
      }

      window.closeAllOverlays();
      window.selectLocatorStore(storeKey);
      applyFilters();
    };
  }

  // ==========================================================================
  // 4. MENU BURGER MOBILE RESPONSIVE
  // ==========================================================================
  function initMobileBurgerMenu() {
    const headerLeft = document.querySelector('.header-left');
    if (!headerLeft || !el.mainNav) return;

    const burgerBtn = document.createElement('button');
    burgerBtn.className = 'mobile-menu-btn';
    burgerBtn.setAttribute('aria-label', 'Menu Principal');
    burgerBtn.innerHTML = '&#9776;';
    headerLeft.insertBefore(burgerBtn, headerLeft.firstChild);

    burgerBtn.addEventListener('click', () => {
      const isOpen = el.mainNav.classList.toggle('mobile-open');
      burgerBtn.innerHTML = isOpen ? '&times;' : '&#9776;';
    });

    // Fermer le menu lors d'un clic sur un lien
    el.mainNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        el.mainNav.classList.remove('mobile-open');
        burgerBtn.innerHTML = '&#9776;';
      });
    });
  }

  // ==========================================================================
  // 5. FONCTIONS DE SCROLL FLUIDES
  // ==========================================================================
  window.scrollToTopSection = function (e) {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.scrollToCatalogSection = function (e) {
    if (e) e.preventDefault();
    const sec = document.getElementById('catalog');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  };

  window.scrollToServicesSection = function (e) {
    if (e) e.preventDefault();
    const sec = document.getElementById('services');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  };

  window.scrollToLocatorSection = function (e) {
    if (e) e.preventDefault();
    const sec = document.getElementById('store-locator');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  };

  window.filterByNavCategory = function (e, category) {
    if (e) e.preventDefault();
    state.activeCategory = category;
    if (el.categorySelect) {
      const matchOpt = Array.from(el.categorySelect.options).find(opt => 
        opt.value.toLowerCase() === category.toLowerCase() || 
        opt.value.toLowerCase().includes(category.toLowerCase()) ||
        category.toLowerCase().includes(opt.value.toLowerCase())
      );
      if (matchOpt) el.categorySelect.value = matchOpt.value;
      else el.categorySelect.value = 'all';
    }
    window.scrollToCatalogSection();
    applyFilters();
  };

  window.openWhatsAppContact = function (storeKey) {
    const store = SHOWROOMS[storeKey] || SHOWROOMS.falaise;
    const url = `https://wa.me/${store.waNumber}?text=Bonjour%20Maison%20L'Oréal%20Capitol,%20je%20souhaite%20prendre%20rendez-vous%20au%20showroom%20${encodeURIComponent(store.shortName)}.`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ==========================================================================
  // 6. ITINÉRAIRE GPS EN DIRECT VERS YAOUNDÉ (MOBILE & DESKTOP SANS BLOCAGE)
  // ==========================================================================
  window.openGpsRoute = function (storeKey) {
    // Coordonnées exactes et universelles de nos showrooms à Yaoundé
    let destination = "3.8703554,11.5154798"; // Showroom La Falaise Yaoundé
    if (storeKey === 'tougou') {
      destination = "VGJF+W8C, Rue Onembele Nkou, Yaoundé, Cameroun";
    }

    // Google Maps Directions Universal :
    // Quand l'origine est omise, Google Maps calcule immédiatement l'itinéraire depuis la position GPS actuelle
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&dir_action=navigate`;

    // Détection de l'appareil
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || window.innerWidth <= 768;

    if (isMobile) {
      // EXÉCUTION SYNCHRONE SUR MOBILE :
      // Utilise window.location.href pour ouvrir directement l'application Maps ou le navigateur sans être bloqué par Safari iOS ou Chrome Android
      window.location.href = mapsUrl;
    } else {
      // Sur PC / Desktop : nouvel onglet propre
      const newWin = window.open(mapsUrl, '_blank', 'noopener,noreferrer');
      if (!newWin) {
        window.location.href = mapsUrl;
      }
    }
  };

  // ==========================================================================
  // 7. STORE LOCATOR ONGLETS & RECHERCHE ÉPURÉE
  // ==========================================================================
  window.selectLocatorStore = function (storeKey) {
    if (el.locTabAll) el.locTabAll.classList.toggle('active', storeKey === 'all');
    if (el.locTabFalaise) el.locTabFalaise.classList.toggle('active', storeKey === 'falaise');
    if (el.locTabTougou) el.locTabTougou.classList.toggle('active', storeKey === 'tougou');

    if (el.cardStoreFalaise) {
      el.cardStoreFalaise.style.display = (storeKey === 'all' || storeKey === 'falaise') ? 'flex' : 'none';
    }
    if (el.cardStoreTougou) {
      el.cardStoreTougou.style.display = (storeKey === 'all' || storeKey === 'tougou') ? 'flex' : 'none';
    }
  };

  window.filterLocatorStores = function (query) {
    const q = (query || '').toLowerCase().trim();
    if (el.clearLocSearchBtn) {
      el.clearLocSearchBtn.style.display = q ? 'block' : 'none';
    }

    const falaiseKeywords = 'la falaise yaoundé yaounde vgc8+58f 699942024 694389584 costumes mack james berwick apparat flagship'.toLowerCase();
    const tougouKeywords = 'tougou yaoundé yaounde vgj+w8c vgjf+w8c onembele nkou 670371820 prêt-à-porter prêt à porter chic robes cérémonie'.toLowerCase();

    if (el.cardStoreFalaise) {
      el.cardStoreFalaise.style.display = (!q || falaiseKeywords.includes(q)) ? 'flex' : 'none';
    }
    if (el.cardStoreTougou) {
      el.cardStoreTougou.style.display = (!q || tougouKeywords.includes(q)) ? 'flex' : 'none';
    }
  };

  window.clearLocatorSearch = function () {
    if (el.locatorSearchInput) {
      el.locatorSearchInput.value = '';
      window.filterLocatorStores('');
      el.locatorSearchInput.focus();
    }
  };

  // ==========================================================================
  // 8. SYNCHRONISATION FIREBASE & TRAITEMENT DU STOCK
  // ==========================================================================
  function loadCachedPhotos() {
    try {
      const cached = localStorage.getItem('loreal_model_photos');
      if (cached) {
        state.modelPhotos = JSON.parse(cached);
      }
    } catch (e) {}
  }

  function loadCachedCatalog() {
    try {
      const cached = localStorage.getItem('loreal_products_cache');
      const prodJson = cached ? JSON.parse(cached) : (window.__LOREAL_INITIAL_PRODUCTS__ || null);
      if (prodJson && typeof prodJson === 'object' && Object.keys(prodJson).length > 0) {
        processCatalog(prodJson, {});
        populateDropdowns();
        applyFilters(false);
      }
    } catch (e) {
      if (window.__LOREAL_INITIAL_PRODUCTS__) {
        processCatalog(window.__LOREAL_INITIAL_PRODUCTS__, {});
        populateDropdowns();
        applyFilters(false);
      }
    }
  }

  function savePhotoLocally(key, photoData) {
    try {
      state.modelPhotos[key] = photoData;
      state.modelPhotos[safePhotoKey(key)] = photoData;
      localStorage.setItem('loreal_model_photos', JSON.stringify(state.modelPhotos));
    } catch (e) {}
  }

  let photosLoadedOnce = false;
  let isFetchingPhotos = false;

  async function loadCloudPhotosInBackground() {
    if (isFetchingPhotos) return;
    isFetchingPhotos = true;
    try {
      const photoRes = await fetch(CLOUD_PHOTOS_URL);
      if (photoRes && photoRes.ok) {
        const photoJson = await photoRes.json();
        if (photoJson && typeof photoJson === 'object') {
          state.modelPhotos = Object.assign({}, state.modelPhotos, photoJson);
          photosLoadedOnce = true;
          try {
            localStorage.setItem('loreal_model_photos', JSON.stringify(state.modelPhotos));
          } catch (e) {}
          if (state.groupedModels.length > 0) {
            renderProducts();
          }
        }
      }
    } catch (e) {
    } finally {
      isFetchingPhotos = false;
    }
  }

  async function loadCatalogData(isBackgroundSync = false) {
    // 1. Si aucun produit n'est encore affiché, afficher immédiatement le snapshot embarqué ou le cache (0 ms)
    if (!state.groupedModels.length) {
      loadCachedCatalog();
    }

    // 2. Lancer le chargement des photos en arrière-plan sans jamais bloquer l'affichage du catalogue
    if (!photosLoadedOnce) {
      loadCloudPhotosInBackground();
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;

      const prodRes = await fetch(CLOUD_PRODUCTS_URL, {
        signal: controller ? controller.signal : undefined
      }).catch(() => null);

      if (timer) clearTimeout(timer);

      if (!prodRes || !prodRes.ok) {
        if (!state.groupedModels.length) {
          loadCachedCatalog();
        }
        return;
      }

      const prodJson = await prodRes.json() || {};
      if (Object.keys(prodJson).length === 0) {
        if (!state.groupedModels.length) {
          loadCachedCatalog();
        }
        return;
      }

      // Sauvegarde légère dans le cache local (sans images base64 dupliquées)
      try {
        const lightCache = {};
        Object.keys(prodJson).forEach(k => {
          if (prodJson[k]) {
            const copy = Object.assign({}, prodJson[k]);
            delete copy.imageUrl;
            delete copy.photo;
            delete copy.image;
            lightCache[k] = copy;
          }
        });
        localStorage.setItem('loreal_products_cache', JSON.stringify(lightCache));
      } catch (e) {}

      processCatalog(prodJson, {});

      if (!isBackgroundSync) {
        populateDropdowns();
        applyFilters(false);
      } else {
        applyFilters(false);
      }
    } catch (err) {
      console.error('Synchronisation discrète...', err);
      if (!state.groupedModels.length) {
        loadCachedCatalog();
      }
    }
  }

  function processCatalog(prodJson, advJson) {
    const modelsMap = new Map();

    Object.keys(prodJson || {}).forEach(key => {
      const p = prodJson[key];
      if (!p) return;

      const id = key;
      const rawName = (p.name || p.designation || "Pièce L'Oréal Capitol").trim();
      const rawRef = (p.reference || p.code || p.ref || '').trim();
      const category = (p.category || 'Autre').trim();
      const rawColor = (p.color || p.couleur || 'Non défini').trim();
      const rawSize = String(p.size || p.taille || '').trim();
      let price = Number(p.price || p.sellingPrice || p.prix || 0);

      // PRIX OFFICIELS REQUIS PAR LA MAISON
      const searchText = `${rawName} ${rawRef} ${category}`.toLowerCase();
      if (searchText.includes('mackjames') || searchText.includes('mack james') || searchText.includes('mack-james')) {
        if (price <= 0) price = 150000;
      } else if (searchText.includes('berwick')) {
        if (price <= 0) price = 120000;
      }

      const storeRaw = String(p.storeId || p.store || p.storeName || p.boutique || 'falaise').toLowerCase();
      const storeKey = storeRaw.includes('tougou') ? 'tougou' : 'falaise';

      // Détection Genre élégante
      const catLower = category.toLowerCase();
      const nameLower = rawName.toLowerCase();
      let gender = 'all';
      if (
        catLower.includes('femme') || catLower.includes('dame') || catLower.includes('robe') || catLower.includes('jupe') ||
        nameLower.includes('femme') || nameLower.includes('dame') || nameLower.includes('robe') || nameLower.includes('jupe')
      ) {
        gender = 'femme';
      } else if (
        catLower.includes('homme') || catLower.includes('costume') || catLower.includes('albacost') ||
        catLower.includes('veste') || catLower.includes('chemise') || catLower.includes('cravate') ||
        nameLower.includes('homme')
      ) {
        gender = 'homme';
      }

      // Stock physique réel conforme à l'application et au fichier Excel
      const stock = Math.max(0, parseInt(p.stock !== undefined ? p.stock : (p.quantity !== undefined ? p.quantity : 0), 10) || 0);

      // Normalisation de couleur avec fusion des synonymes (Marron Daim, Bleu Nuit, etc.)
      const normColor = normalizeColor(rawColor);

      // Clé unique de regroupement par article exact
      const modelKey = `${rawName.toLowerCase()}___${category.toLowerCase()}___${rawRef.toLowerCase()}`;

      const rawProductItem = {
        id,
        name: rawName,
        category: category,
        reference: rawRef,
        color: rawColor,
        normColor: normColor,
        size: rawSize,
        price: price,
        stock: stock,
        store: storeKey,
        ...p
      };

      const existingProductPhoto = p.imageUrl || p.photo || p.image || null;
      if (existingProductPhoto) {
        if (!state.modelPhotos[modelKey]) {
          state.modelPhotos[modelKey] = existingProductPhoto;
        }
        const colorPhotoKey = `${modelKey}___${normColor}`;
        if (!state.modelPhotos[colorPhotoKey]) {
          state.modelPhotos[colorPhotoKey] = existingProductPhoto;
        }
      }

      if (!modelsMap.has(modelKey)) {
        const colorVariants = {};
        colorVariants[normColor] = {
          colorName: normColor,
          sizes: new Set(rawSize ? [rawSize] : []),
          sizeUnits: rawSize ? { [rawSize]: stock } : {},
          totalUnits: stock,
          stores: new Set([storeKey]),
          photoKey: `${modelKey}___${normColor}`
        };

        modelsMap.set(modelKey, {
          modelKey,
          firstId: id,
          reference: rawRef,
          name: rawName,
          category: category,
          gender: gender,
          price: price,
          totalUnits: stock,
          sizes: new Set(rawSize ? [rawSize] : []),
          colorVariants: colorVariants,
          stores: new Set([storeKey]),
          itemsCount: 1,
          rawItems: [rawProductItem]
        });
      } else {
        const existing = modelsMap.get(modelKey);
        existing.totalUnits += stock;
        if (rawSize) existing.sizes.add(rawSize);
        existing.stores.add(storeKey);
        existing.itemsCount += 1;
        existing.rawItems.push(rawProductItem);
        if (price > 0 && existing.price === 0) {
          existing.price = price;
        }

        if (!existing.colorVariants[normColor]) {
          existing.colorVariants[normColor] = {
            colorName: normColor,
            sizes: new Set(rawSize ? [rawSize] : []),
            sizeUnits: rawSize ? { [rawSize]: stock } : {},
            totalUnits: stock,
            stores: new Set([storeKey]),
            photoKey: `${modelKey}___${normColor}`
          };
        } else {
          const cv = existing.colorVariants[normColor];
          cv.totalUnits += stock;
          cv.stores.add(storeKey);
          if (rawSize) {
            cv.sizes.add(rawSize);
            cv.sizeUnits[rawSize] = (cv.sizeUnits[rawSize] || 0) + stock;
          }
        }
      }
    });

    const list = Array.from(modelsMap.values()).map(m => {
      const colorsList = Object.keys(m.colorVariants).map(colorName => {
        const v = m.colorVariants[colorName];
        return {
          colorName,
          sizesArray: Array.from(v.sizes).filter(s => s && s !== 'Standard').sort(sortSizes),
          sizeUnits: v.sizeUnits,
          totalUnits: v.totalUnits,
          storesArray: Array.from(v.stores),
          photoKey: v.photoKey,
          palette: getColorPalette(colorName)
        };
      });

      // Trier les coloris par stock disponible décroissant
      colorsList.sort((a, b) => b.totalUnits - a.totalUnits);

      // Si le modèle n'a pas encore de couleur active sélectionnée, on prend la première disponible
      const defaultColor = (colorsList[0] && colorsList[0].colorName) || 'Noir';

      const allReferences = new Set();
      if (m.reference) allReferences.add(m.reference.toLowerCase());
      (m.rawItems || []).forEach(it => {
        if (it.reference) allReferences.add(String(it.reference).toLowerCase());
        if (it.code) allReferences.add(String(it.code).toLowerCase());
        if (it.barcode) allReferences.add(String(it.barcode).toLowerCase());
        if (it.ref) allReferences.add(String(it.ref).toLowerCase());
      });

      return {
        ...m,
        selectedColor: defaultColor,
        colorsList: colorsList,
        sizesArray: Array.from(m.sizes).filter(s => s && s !== 'Standard').sort(sortSizes),
        colorsArray: colorsList.map(c => c.colorName),
        storesArray: Array.from(m.stores),
        rawItems: m.rawItems || [],
        allRefsString: Array.from(allReferences).join(' ')
      };
    });

    // Trier les modèles par nom alphabétique
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));

    state.groupedModels = list;
  }

  function sortSizes(a, b) {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    const order = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
    const idxA = order.indexOf(a.toUpperCase());
    const idxB = order.indexOf(b.toUpperCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    return a.localeCompare(b, 'fr');
  }

  function populateDropdowns() {
    const categoriesSet = new Set();
    const sizesSet = new Set();

    state.groupedModels.forEach(m => {
      if (m.category) categoriesSet.add(m.category);
      m.sizesArray.forEach(sz => sizesSet.add(sz));
    });

    const sortedCats = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b, 'fr'));
    if (el.categorySelect) {
      el.categorySelect.innerHTML = '<option value="all">Toutes les catégories</option>' +
        sortedCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }

    const sortedSizes = Array.from(sizesSet).sort(sortSizes);
    if (el.sizeSelect) {
      el.sizeSelect.innerHTML = '<option value="all">Toutes les tailles</option>' +
        sortedSizes.map(s => `<option value="${escapeHtml(s)}">Taille ${escapeHtml(s)}</option>`).join('');
    }
  }

  // ==========================================================================
  // 9. FILTRAGE ET RECHERCHE HAUTE PRÉCISION
  // ==========================================================================
  function matchesSearchQuery(m, term) {
    if (!term) return true;
    const termClean = term.trim().toLowerCase();
    const words = termClean.split(/\s+/).filter(Boolean);
    const sizesStr = (m.sizesArray || []).join(' ').toLowerCase();
    const colorsStr = (m.colorsArray || []).join(' ').toLowerCase();
    const allRefs = (m.allRefsString || m.reference || '').toLowerCase();
    const full = `${m.name || ''} ${m.reference || ''} ${allRefs} ${m.category || ''} ${sizesStr} ${colorsStr}`.toLowerCase();
    
    // Test direct sous-chaîne
    if (full.includes(termClean)) return true;

    // Test sans caractères spéciaux (ex: '9675' correspond à 'REF-9675' ou 'CAP-002878-0049')
    const rawDigitsTerm = termClean.replace(/[^a-z0-9]/gi, '');
    const rawDigitsFull = full.replace(/[^a-z0-9]/gi, '');
    if (rawDigitsTerm.length >= 3 && rawDigitsFull.includes(rawDigitsTerm)) return true;

    // Test multi-mots (ex: "mack 9675" ou "costume noir")
    return words.every(w => {
      const wClean = w.replace(/[^a-z0-9]/gi, '');
      return full.includes(w) || (wClean.length >= 3 && rawDigitsFull.includes(wClean));
    });
  }

  function applyFilters(resetPage = true) {
    if (resetPage) state.page = 1;

    const q = state.searchQuery.toLowerCase().trim();
    let gender = state.activeGender;
    const store = state.activeStore;
    const cat = state.activeCategory;
    const size = state.activeSize;

    const checkModel = (m, g, c, st, sz) => {
      if (g !== 'all' && m.gender !== 'all' && m.gender !== g) return false;
      if (st !== 'all' && !m.stores.has(st)) return false;
      if (c !== 'all') {
        const catLow = c.toLowerCase();
        const mCatLow = (m.category || '').toLowerCase();
        if (mCatLow !== catLow && !mCatLow.includes(catLow) && !catLow.includes(mCatLow)) return false;
      }
      if (sz !== 'all' && !m.sizes.has(sz)) return false;
      return matchesSearchQuery(m, q);
    };

    let filtered = state.groupedModels.filter(m => checkModel(m, gender, cat, store, size));

    // Si une recherche textuelle/référence est active (ex: "9675") et qu'elle ne donne aucun résultat
    // parce qu'un filtre de genre antérieur (ex: "Femme") était sélectionné :
    // On élargit automatiquement pour afficher immédiatement les pièces correspondantes du catalogue !
    if (q && filtered.length === 0 && gender !== 'all') {
      const allGenderMatches = state.groupedModels.filter(m => checkModel(m, 'all', cat, store, size));
      if (allGenderMatches.length > 0) {
        filtered = allGenderMatches;
        state.activeGender = 'all';
        gender = 'all';
        document.querySelectorAll('.gender-pill-tabs .pill-tab').forEach(tab => {
          tab.classList.toggle('active', tab.getAttribute('data-gender') === 'all');
        });
      }
    }

    // Si toujours aucun résultat pour la recherche et qu'une catégorie spécifique était verrouillée
    if (q && filtered.length === 0 && cat !== 'all') {
      const allCatMatches = state.groupedModels.filter(m => checkModel(m, 'all', 'all', store, size));
      if (allCatMatches.length > 0) {
        filtered = allCatMatches;
        state.activeCategory = 'all';
        state.activeGender = 'all';
        if (el.categorySelect) el.categorySelect.value = 'all';
        document.querySelectorAll('.gender-pill-tabs .pill-tab').forEach(tab => {
          tab.classList.toggle('active', tab.getAttribute('data-gender') === 'all');
        });
      }
    }

    state.filteredModels = filtered;
    updateBadgeTitle();
    renderProducts();
  }

  function updateBadgeTitle() {
    let genderLabel = 'COLLECTION GLOBALE';
    if (state.activeGender === 'homme') genderLabel = 'COLLECTION HOMME';
    if (state.activeGender === 'femme') genderLabel = 'COLLECTION FEMME';

    let storeLabel = 'SHOWROOMS YAOUNDÉ';
    if (state.activeStore === 'falaise') storeLabel = 'BOUTIQUE LA FALAISE';
    if (state.activeStore === 'tougou') storeLabel = 'BOUTIQUE TOUGOU';

    if (el.activeFilterBadge) {
      el.activeFilterBadge.textContent = `${genderLabel} • ${storeLabel}`;
    }
  }

  window.setGenderFilter = function (gender) {
    state.activeGender = gender;
    document.querySelectorAll('.gender-pill-tabs .pill-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-gender') === gender);
    });
    applyFilters();
  };

  // ==========================================================================
  // 10. RENDU STRICT EN 2 COLONNES & ZOOM INTERACTIF
  // ==========================================================================
  function renderProducts() {
    if (!el.productsGrid) return;
    const total = state.filteredModels.length;

    if (el.resultsCount) {
      el.resultsCount.innerHTML = `<strong>${total}</strong> modèle${total > 1 ? 's' : ''}`;
    }

    if (total === 0) {
      el.productsGrid.innerHTML = `
        <div style="grid-column: span 2; text-align: center; padding: 60px 20px;">
          <h3 style="font-family: var(--font-serif); font-size: 20px; color: var(--gold-light); margin-bottom: 10px;">
            Aucun modèle ne correspond actuellement
          </h3>
          <p style="font-size: 13px; color: var(--text-gray);">
            Ajustez vos filtres ou réinitialisez la recherche.
          </p>
        </div>
      `;
      if (el.paginationWrapper) el.paginationWrapper.style.display = 'none';
      return;
    }

    const itemsToShow = state.filteredModels.slice(0, state.page * state.pageSize);

    el.productsGrid.innerHTML = itemsToShow.map(m => {
      let storeBadgeText = '📍 La Falaise';
      if (m.stores.has('falaise') && m.stores.has('tougou')) {
        storeBadgeText = '📍 La Falaise & Tougou';
      } else if (m.stores.has('tougou')) {
        storeBadgeText = '📍 Tougou';
      }

      const genderBadge = m.gender === 'femme' ? '👗 Femme' : '👔 Homme';

      const activeColorName = m.selectedColor || (m.colorsList[0] ? m.colorsList[0].colorName : 'Noir');
      const activeVariant = m.colorsList.find(c => c.colorName === activeColorName) || m.colorsList[0] || {
        colorName: activeColorName,
        sizesArray: m.sizesArray,
        totalUnits: m.totalUnits
      };

      const sizesText = activeVariant.sizesArray.length > 0 
        ? activeVariant.sizesArray.join(', ')
        : 'Taille Unique';

      const unitsLabel = activeVariant.totalUnits > 1 
        ? `${activeVariant.totalUnits} pièces prêtes en ${activeVariant.colorName}` 
        : (activeVariant.totalUnits === 1 
          ? `Dernière unité en ${activeVariant.colorName} !` 
          : `Sur commande en ${activeVariant.colorName}`);
      const statusClass = activeVariant.totalUnits === 1 ? 'last-item' : (activeVariant.totalUnits === 0 ? 'last-item' : 'in-stock');

      const photoSrc = getModelColorPhoto(m.modelKey, activeVariant.colorName);

      let photoFrameHtml = '';
      if (photoSrc) {
        photoFrameHtml = `
          <div class="product-photo-frame has-photo" onclick="toggleCardZoom(event, this, '${escapeHtml(m.modelKey)}')">
            <img src="${photoSrc}" alt="${escapeHtml(m.name)}" class="product-real-img" loading="lazy">
            <span class="zoom-hint-badge" onclick="event.stopPropagation(); openImageZoom('${photoSrc}', '${escapeHtml(m.name)}', 'RÉF : ${escapeHtml(m.reference)} • ${escapeHtml(activeVariant.colorName)}')">🔍 Zoom</span>
            <button class="change-photo-btn" onclick="handleCardPhotoUpload(event, '${escapeHtml(m.modelKey)}', '${escapeHtml(activeVariant.colorName)}')" title="Prendre/Modifier la photo pour ${escapeHtml(activeVariant.colorName)}">📷 Photo (${escapeHtml(activeVariant.colorName)})</button>
            <span class="badge-boutique">${storeBadgeText}</span>
            <span class="badge-gender">${genderBadge}</span>
          </div>
        `;
      } else {
        photoFrameHtml = `
          <div class="product-photo-frame is-placeholder" onclick="handleCardPhotoUpload(event, '${escapeHtml(m.modelKey)}', '${escapeHtml(activeVariant.colorName)}')">
            <span class="badge-boutique">${storeBadgeText}</span>
            <span class="badge-gender">${genderBadge}</span>
            <div class="photo-placeholder-box">
              <span class="photo-watermark-monogram">LC</span>
              <div class="photo-camera-icon">📷</div>
              <span class="photo-badge-caption">+ PHOTO (${escapeHtml(activeVariant.colorName).toUpperCase()})</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="product-card" data-model="${escapeHtml(m.modelKey)}" onclick="openProductModal('${escapeHtml(m.modelKey)}')">
          ${photoFrameHtml}

          <div class="product-body">
            <div class="product-meta-row">
              <span class="product-category">${escapeHtml(m.category)}</span>
              <span class="product-ref">${escapeHtml(m.reference)}</span>
            </div>

            <h3 class="product-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</h3>

            <!-- Pastilles de Couleurs en Forme de Cercle -->
            <div class="product-colors-swatches" onclick="event.stopPropagation()">
              ${m.colorsList.map(c => `
                <button 
                  type="button" 
                  class="color-swatch-circle ${c.colorName === activeVariant.colorName ? 'active' : ''}" 
                  data-color="${escapeHtml(c.colorName)}" 
                  title="${escapeHtml(c.colorName)} (${c.totalUnits} pièces prêtes)" 
                  style="background: ${c.palette.gradient || c.palette.hex}; border-color: ${c.palette.border};" 
                  onclick="selectCardColor(event, '${escapeHtml(m.modelKey)}', '${escapeHtml(c.colorName)}')"
                  aria-label="${escapeHtml(c.colorName)}"
                ></button>
              `).join('')}
              <span class="color-swatch-active-label">${escapeHtml(activeVariant.colorName)}</span>
            </div>

            <div class="product-specs">
              Pointures/Tailles: <strong class="product-specs-sizes">${escapeHtml(sizesText)}</strong>
            </div>

            <div class="product-stock-pill ${statusClass}">
              <span class="stock-bullet"></span>
              <span class="product-stock-text">${unitsLabel}</span>
            </div>

            <div class="product-foot">
              <div class="product-price-block">
                <span class="price-title">Prix Boutique</span>
                <span class="price-amount">${formatPrice(m.price)} FCFA</span>
              </div>
              <button class="product-view-btn" type="button" onclick="event.stopPropagation(); openProductModal('${escapeHtml(m.modelKey)}')">
                Réserver dès maintenant →
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (el.paginationWrapper) {
      el.paginationWrapper.style.display = itemsToShow.length < total ? 'block' : 'none';
    }
  }

  window.selectCardColor = function (event, modelKey, colorName) {
    if (event) event.stopPropagation();
    const card = document.querySelector(`.product-card[data-model="${cssEscape(modelKey)}"]`);
    const model = state.groupedModels.find(m => m.modelKey === modelKey);
    if (!card || !model) return;

    model.selectedColor = colorName;
    const variant = model.colorsList.find(c => c.colorName === colorName) || model.colorsList[0];
    if (!variant) return;

    // 1. Mettre à jour les cercles actifs
    card.querySelectorAll('.color-swatch-circle').forEach(btn => {
      const isAct = btn.getAttribute('data-color') === colorName;
      btn.classList.toggle('active', isAct);
    });

    const activeLabel = card.querySelector('.color-swatch-active-label');
    if (activeLabel) activeLabel.textContent = colorName;

    // 2. Mettre à jour les pointures pour cette couleur
    const sizesEl = card.querySelector('.product-specs-sizes');
    if (sizesEl) {
      const szText = variant.sizesArray.length > 0 ? variant.sizesArray.join(', ') : 'Taille Unique';
      sizesEl.textContent = szText;
    }

    // 3. Mettre à jour les unités disponibles pour cette couleur
    const stockPill = card.querySelector('.product-stock-pill');
    const stockText = card.querySelector('.product-stock-text');
    if (stockText) {
      stockText.textContent = variant.totalUnits > 1 
        ? `${variant.totalUnits} pièces prêtes en ${colorName}`
        : (variant.totalUnits === 1 
          ? `Dernière unité en ${colorName} !` 
          : `Sur commande en ${colorName}`);
    }
    if (stockPill) {
      stockPill.className = `product-stock-pill ${variant.totalUnits === 1 ? 'last-item' : (variant.totalUnits === 0 ? 'last-item' : 'in-stock')}`;
    }

    // 4. Mettre à jour la photo affichée pour cette teinte spécifique
    const photoSrc = getModelColorPhoto(modelKey, colorName);
    const photoFrame = card.querySelector('.product-photo-frame');
    if (photoFrame) {
      let storeBadgeText = '📍 La Falaise';
      if (model.stores.has('falaise') && model.stores.has('tougou')) {
        storeBadgeText = '📍 La Falaise & Tougou';
      } else if (model.stores.has('tougou')) {
        storeBadgeText = '📍 Tougou';
      }
      const genderBadge = model.gender === 'femme' ? '👗 Femme' : '👔 Homme';

      if (photoSrc) {
        photoFrame.className = 'product-photo-frame has-photo';
        photoFrame.setAttribute('onclick', `toggleCardZoom(event, this, '${escapeHtml(modelKey)}')`);
        photoFrame.innerHTML = `
          <img src="${photoSrc}" alt="${escapeHtml(model.name)}" class="product-real-img" loading="lazy">
          <span class="zoom-hint-badge" onclick="event.stopPropagation(); openImageZoom('${photoSrc}', '${escapeHtml(model.name)}', 'RÉF : ${escapeHtml(model.reference)} • ${escapeHtml(colorName)}')">🔍 Zoom</span>
          <button class="change-photo-btn" onclick="handleCardPhotoUpload(event, '${escapeHtml(model.modelKey)}', '${escapeHtml(colorName)}')" title="Prendre/Modifier la photo pour ${escapeHtml(colorName)}">📷 Photo (${escapeHtml(colorName)})</button>
          <span class="badge-boutique">${storeBadgeText}</span>
          <span class="badge-gender">${genderBadge}</span>
        `;
      } else {
        photoFrame.className = 'product-photo-frame is-placeholder';
        photoFrame.setAttribute('onclick', `handleCardPhotoUpload(event, '${escapeHtml(model.modelKey)}', '${escapeHtml(colorName)}')`);
        photoFrame.innerHTML = `
          <span class="badge-boutique">${storeBadgeText}</span>
          <span class="badge-gender">${genderBadge}</span>
          <div class="photo-placeholder-box">
            <span class="photo-watermark-monogram">LC</span>
            <div class="photo-camera-icon">📷</div>
            <span class="photo-badge-caption">+ PHOTO (${escapeHtml(colorName).toUpperCase()})</span>
          </div>
        `;
      }
    }
  };

  // --- ZOOM INTERACTIF AU SURVOL ET AU CLIC ---
  window.toggleCardZoom = function (event, frameEl, modelKey) {
    if (event) event.stopPropagation();
    const isAlreadyZoomed = frameEl.classList.contains('is-zoomed');

    // Fermer les autres cartes zoomées
    document.querySelectorAll('.product-photo-frame.is-zoomed').forEach(node => {
      if (node !== frameEl) node.classList.remove('is-zoomed');
    });

    frameEl.classList.toggle('is-zoomed');

    // Au second clic sur la photo déjà agrandie, ouverture du zoom plein écran
    if (isAlreadyZoomed) {
      const model = state.groupedModels.find(m => m.modelKey === modelKey);
      const photoSrc = state.modelPhotos[modelKey];
      if (photoSrc && model) {
        window.openImageZoom(photoSrc, model.name, `RÉF : ${model.reference} • ${model.category}`);
      }
    }
  };

  // ==========================================================================
  // 11. MODAL LOOKBOOK ZOOM HAUTE RÉSOLUTION (AVEC PAN & BOUTONS)
  // ==========================================================================
  window.openImageZoom = function (src, title, ref) {
    if (el.zoomActiveImg) {
      el.zoomActiveImg.src = src;
      state.currentZoomScale = 1;
      el.zoomActiveImg.style.transform = 'scale(1)';
    }
    if (el.zoomCaptionTitle) el.zoomCaptionTitle.textContent = title || "Maison L'Oréal Capitol";
    if (el.zoomCaptionRef) el.zoomCaptionRef.textContent = ref || "Showrooms Yaoundé";
    if (el.imageZoomModal) el.imageZoomModal.style.display = 'flex';
  };

  window.closeImageZoom = function (event) {
    if (event && event.target && event.target.closest('.image-zoom-container') && !event.target.classList.contains('zoom-close-btn')) {
      return;
    }
    if (el.imageZoomModal) el.imageZoomModal.style.display = 'none';
  };

  window.zoomInImg = function () {
    state.currentZoomScale = Math.min(state.currentZoomScale + 0.35, 3.5);
    if (el.zoomActiveImg) el.zoomActiveImg.style.transform = `scale(${state.currentZoomScale})`;
  };

  window.zoomOutImg = function () {
    state.currentZoomScale = Math.max(state.currentZoomScale - 0.35, 0.7);
    if (el.zoomActiveImg) el.zoomActiveImg.style.transform = `scale(${state.currentZoomScale})`;
  };

  window.resetZoomImg = function () {
    state.currentZoomScale = 1;
    if (el.zoomActiveImg) el.zoomActiveImg.style.transform = 'scale(1)';
  };

  // ==========================================================================
  // 12. PRISE DE PHOTO CAMÉRA EN DIRECT & SÉLECTION GALERIE
  // ==========================================================================
  window.handleCardPhotoUpload = function (event, modelKey, targetColor) {
    if (event) event.stopPropagation();
    openPhotoActionModal(modelKey, targetColor);
  };

  function openPhotoActionModal(modelKey, targetColor) {
    const model = state.groupedModels.find(m => m.modelKey === modelKey);
    if (!model) return;

    const chosenColor = targetColor || model.selectedColor || (model.colorsList[0] ? model.colorsList[0].colorName : 'Noir');
    state.targetPhotoModelKey = modelKey;
    state.targetPhotoColor = chosenColor;

    if (el.photoTargetTitle) el.photoTargetTitle.textContent = model.name;
    if (el.photoTargetRef) el.photoTargetRef.textContent = `RÉF : ${model.reference} • ${model.category} — Teinte : ${chosenColor}`;

    if (el.photoActionModal) el.photoActionModal.style.display = 'flex';
  }

  function closePhotoActionModal() {
    if (el.photoActionModal) el.photoActionModal.style.display = 'none';
    state.targetPhotoModelKey = null;
    state.targetPhotoColor = null;
  }

  function initPhotoInputs() {
    if (el.btnSnapPhoto) {
      el.btnSnapPhoto.addEventListener('click', () => {
        if (el.cameraInput) el.cameraInput.click();
      });
    }
    if (el.btnPickGallery) {
      el.btnPickGallery.addEventListener('click', () => {
        if (el.galleryInput) el.galleryInput.click();
      });
    }
    if (el.btnCancelPhoto) {
      el.btnCancelPhoto.addEventListener('click', closePhotoActionModal);
    }
    if (el.photoActionModal) {
      el.photoActionModal.addEventListener('click', (e) => {
        if (e.target === el.photoActionModal) closePhotoActionModal();
      });
    }

    if (el.cameraInput) el.cameraInput.addEventListener('change', handleFileSelected);
    if (el.galleryInput) el.galleryInput.addEventListener('change', handleFileSelected);

    if (el.modalPhotoUploadBtn) {
      el.modalPhotoUploadBtn.addEventListener('click', () => {
        if (state.selectedModel) {
          openPhotoActionModal(state.selectedModel.modelKey, state.selectedModalColor);
        }
      });
    }
  }

  async function handleFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !state.targetPhotoModelKey) return;

    const modelKey = state.targetPhotoModelKey;
    const color = state.targetPhotoColor || 'Noir';
    const specificPhotoKey = `${modelKey}___${color}`;
    closePhotoActionModal();

    showAdminToast('Enregistrement et optimisation de la photo en cours...', 'info');

    try {
      // Conservation stricte de la photo originale telle que prise/importée par l'utilisateur (sans détourage ni blanchiment)
      const { dataUrl, sizeKb } = await processUserImage(file, 1000, 0.82);

      // 2. Enregistrer sous la clé spécifique de cette couleur et clé principale
      savePhotoLocally(specificPhotoKey, dataUrl);
      if (!state.modelPhotos[modelKey]) {
        savePhotoLocally(modelKey, dataUrl);
      }

      // 3. Synchroniser uniquement avec model_photos sur Firebase (évite d'alourdir products.json avec des base64 dupliqués)
      syncPhotoToCloud(specificPhotoKey, dataUrl);
      if (!state.modelPhotos[modelKey] && !state.modelPhotos[safePhotoKey(modelKey)]) {
        syncPhotoToCloud(modelKey, dataUrl);
      }

      // 5. Mettre à jour l'affichage en direct
      renderProducts();

      if (state.selectedModel && state.selectedModel.modelKey === modelKey) {
        window.selectModalColor(color);
      }

      showAdminToast(`✓ Photo appliquée avec succès ! Poids optimisé : ~${sizeKb} Ko (Firebase 100% préservé)`, 'success');
    } catch (err) {
      console.error('Erreur photo:', err);
      showAdminToast('Erreur lors de l\'enregistrement de la photo : ' + err.message, 'error');
    } finally {
      event.target.value = '';
    }
  }

  function processUserImage(file, maxDimension = 1000, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;

          // Redimensionnement proportionnel uniquement pour les photos géantes (ex: smartphone 4000x3000)
          if (w > maxDimension || h > maxDimension) {
            if (w > h) {
              h = Math.round((h * maxDimension) / w);
              w = maxDimension;
            } else {
              w = Math.round((w * maxDimension) / h);
              h = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          // Dessine la photo exactement telle que prise ou choisie par l'utilisateur (fond et décor 100% conservés)
          ctx.drawImage(img, 0, 0, w, h);

          const finalDataUrl = canvas.toDataURL('image/jpeg', quality);
          const sizeKb = Math.round((finalDataUrl.length * 3) / 4 / 1024);
          resolve({ dataUrl: finalDataUrl, sizeKb });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function syncPhotoToCloud(modelKey, dataUrl) {
    try {
      const safeKey = safePhotoKey(modelKey);
      const patchObj = {};
      patchObj[safeKey] = dataUrl;

      await fetch(CLOUD_PHOTOS_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchObj)
      });
    } catch (e) {}
  }

  // ==========================================================================
  // 13. MODAL DE DÉTAIL & RÉSERVATION DIRECTE WHATSAPP
  // ==========================================================================
  window.openProductModal = function (modelKey) {
    const model = state.groupedModels.find(m => m.modelKey === modelKey);
    if (!model) return;

    state.selectedModel = model;
    state.selectedModalColor = model.selectedColor || (model.colorsList[0] ? model.colorsList[0].colorName : 'Noir');

    let storeDisplayText = 'Boutique La Falaise (Yaoundé)';
    if (model.stores.has('falaise') && model.stores.has('tougou')) {
      storeDisplayText = 'Disponible à La Falaise & Tougou (Yaoundé)';
    } else if (model.stores.has('tougou')) {
      storeDisplayText = 'Boutique Tougou (Yaoundé)';
    }

    if (el.modalCategory) el.modalCategory.textContent = model.category.toUpperCase();
    if (el.modalTitle) el.modalTitle.textContent = model.name;
    if (el.modalPrice) el.modalPrice.textContent = `${formatPrice(model.price)} FCFA`;
    if (el.modalRef) el.modalRef.textContent = model.reference;
    if (el.modalStoreName) el.modalStoreName.textContent = storeDisplayText;
    if (el.modalStoreBadge) el.modalStoreBadge.textContent = `📍 ${storeDisplayText}`;

    // Rendu des pastilles de couleur circulaires dans la modale
    if (el.modalSwatchesContainer) {
      el.modalSwatchesContainer.innerHTML = model.colorsList.map(c => `
        <button 
          type="button" 
          class="modal-swatch-circle ${c.colorName === state.selectedModalColor ? 'active' : ''}" 
          data-color="${escapeHtml(c.colorName)}" 
          title="${escapeHtml(c.colorName)} (${c.totalUnits} pièces prêtes)" 
          style="background: ${c.palette.gradient || c.palette.hex}; border-color: ${c.palette.border};" 
          onclick="selectModalColor('${escapeHtml(c.colorName)}')"
          aria-label="${escapeHtml(c.colorName)}"
        ></button>
      `).join('') + `<span class="color-swatch-active-label" id="modalActiveColorLabel">${escapeHtml(state.selectedModalColor)}</span>`;
    }

    window.selectModalColor(state.selectedModalColor);

    if (el.productModal) el.productModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.selectModalColor = function (colorName) {
    const model = state.selectedModel;
    if (!model) return;

    state.selectedModalColor = colorName;
    model.selectedColor = colorName;
    const variant = model.colorsList.find(c => c.colorName === colorName) || model.colorsList[0];
    if (!variant) return;

    // 1. Cercles actifs dans la modale
    if (el.modalSwatchesContainer) {
      el.modalSwatchesContainer.querySelectorAll('.modal-swatch-circle').forEach(btn => {
        const isAct = btn.getAttribute('data-color') === colorName;
        btn.classList.toggle('active', isAct);
      });
      const lbl = document.getElementById('modalActiveColorLabel');
      if (lbl) lbl.textContent = colorName;
    }

    // 2. Pastilles de pointures pour cette couleur (cliquables pour éditer directement)
    if (el.modalSizesChips) {
      if (variant.sizesArray.length > 0) {
        el.modalSizesChips.innerHTML = variant.sizesArray.map(sz => {
          const qty = variant.sizeUnits[sz] || 1;
          return `<button type="button" class="modal-size-chip" onclick="selectModalSize('${escapeHtml(sz)}')" title="Cliquer pour modifier cette pointure">T. <strong>${escapeHtml(sz)}</strong> <span class="chip-qty">${qty} pc${qty > 1 ? 's' : ''}</span></button>`;
        }).join('');
      } else {
        el.modalSizesChips.innerHTML = `<span class="modal-size-chip">Taille Standard</span>`;
      }
    }

    // Mettre à jour automatiquement le formulaire d'édition pour cette couleur
    populateVariantEditForm(colorName);

    // 3. Unités et statut
    if (el.modalUnits) {
      el.modalUnits.textContent = `${variant.totalUnits} unité${variant.totalUnits > 1 ? 's' : ''} en ${colorName} (${model.totalUnits} au total)`;
    }
    if (el.modalStockStatus) {
      el.modalStockStatus.className = `modal-stock-status ${variant.totalUnits === 1 ? 'last-item' : 'in-stock'}`;
    }
    if (el.modalStockText) {
      el.modalStockText.textContent = `En rayon immédiat • ${variant.totalUnits} pièce(s) prête(s) en ${colorName}`;
    }

    // 4. Photo spécifique à cette couleur
    const photoSrc = getModelColorPhoto(model.modelKey, colorName);
    updateModalPhoto(photoSrc, model.name, colorName);

    // 5. Bouton WhatsApp avec teinte
    let storeInfo = SHOWROOMS.falaise;
    if (model.stores.has('tougou') && !model.stores.has('falaise')) storeInfo = SHOWROOMS.tougou;
    if (el.modalWaBtn) {
      el.modalWaBtn.onclick = () => {
        sendWhatsAppOrder(model, storeInfo, colorName, variant);
      };
    }

    // 6. Bouton Photo avec indication de la teinte
    if (el.modalPhotoUploadBtn) {
      el.modalPhotoUploadBtn.innerHTML = `<span>📷 Photographier / Mettre à jour la photo en <strong>${escapeHtml(colorName)}</strong></span>`;
      el.modalPhotoUploadBtn.onclick = () => {
        openPhotoActionModal(model.modelKey, colorName);
      };
    }
  };

  function updateModalPhoto(photoSrc, modelName, colorName) {
    if (!el.modalPhotoFrame) return;

    const labelColor = colorName ? ` — ${colorName}` : '';
    if (photoSrc) {
      el.modalPhotoFrame.innerHTML = `
        <img src="${photoSrc}" alt="${escapeHtml(modelName)}" class="modal-real-img" onclick="openImageZoom('${photoSrc}', '${escapeHtml(modelName)}', '${escapeHtml(labelColor)}')">
        <span class="modal-zoom-hint" onclick="openImageZoom('${photoSrc}', '${escapeHtml(modelName)}', '${escapeHtml(labelColor)}')">🔍 Cliquer pour zoomer en plein écran</span>
      `;
    } else {
      el.modalPhotoFrame.innerHTML = `
        <div class="photo-placeholder-content" onclick="openPhotoActionModal('${escapeHtml(state.selectedModel ? state.selectedModel.modelKey : '')}', '${escapeHtml(colorName || '')}')">
          <div class="luxury-camera-icon">📷</div>
          <p class="placeholder-main-text">+ AJOUTER PHOTO (${escapeHtml(colorName || '').toUpperCase()})</p>
          <p class="placeholder-sub-text">Photographiez cette pièce ou choisissez dans la galerie.</p>
        </div>
      `;
    }
  }

  function closeProductModal() {
    if (el.productModal) el.productModal.style.display = 'none';
    document.body.style.overflow = '';
    state.selectedModel = null;
    state.selectedModalColor = null;
    state.activeEditingItem = null;

    // Fermer le tiroir d'administration
    const drawer = document.getElementById('adminVariantDrawer');
    if (drawer) drawer.style.display = 'none';
    const arrow = document.getElementById('adminVariantToggleArrow');
    if (arrow) arrow.classList.remove('open');
  }

  // --- GESTION DES COULEURS, TAILLES & UNITÉS DANS LE SITE WEB ---
  window.toggleAdminVariantBox = function () {
    const drawer = document.getElementById('adminVariantDrawer');
    const arrow = document.getElementById('adminVariantToggleArrow');
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none';
    drawer.style.display = isHidden ? 'flex' : 'none';
    if (arrow) arrow.classList.toggle('open', isHidden);
  };

  window.selectModalSize = function (size) {
    if (!state.selectedModel) return;
    populateVariantEditForm(state.selectedModalColor, size);
    showAdminToast(`Pointure ${size} (${state.selectedModalColor}) prête pour modification.`, 'info');
  };

  function populateVariantEditForm(colorName, selectedSize) {
    const model = state.selectedModel;
    if (!model) return;
    const variant = model.colorsList.find(c => c.colorName === colorName) || model.colorsList[0];
    if (!variant) return;

    let matchedItem = null;
    if (model.rawItems && model.rawItems.length > 0) {
      if (selectedSize) {
        matchedItem = model.rawItems.find(it => it.normColor === colorName && String(it.size).trim() === String(selectedSize).trim());
      }
      if (!matchedItem) {
        matchedItem = model.rawItems.find(it => it.normColor === colorName) || model.rawItems[0];
      }
    }

    state.activeEditingItem = matchedItem;

    const editColor = document.getElementById('webEditColor');
    const editSize = document.getElementById('webEditSize');
    const editRef = document.getElementById('webEditRef');
    const editPrice = document.getElementById('webEditPrice');
    const editStock = document.getElementById('webEditStock');

    if (editColor) editColor.value = matchedItem ? (matchedItem.color || colorName) : colorName;
    if (editSize) editSize.value = matchedItem ? (matchedItem.size || '') : (selectedSize || variant.sizesArray[0] || '');
    if (editRef) editRef.value = matchedItem ? (matchedItem.reference || model.reference) : model.reference;
    if (editPrice) editPrice.value = matchedItem ? (matchedItem.price || model.price) : model.price;
    if (editStock) editStock.value = matchedItem ? (matchedItem.stock !== undefined ? matchedItem.stock : matchedItem.quantity) : variant.totalUnits;
  }

  function showAdminToast(msg, type = 'info') {
    const toast = document.getElementById('adminStatusToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `admin-status-toast ${type}`;
    toast.style.display = 'block';
    if (type !== 'info') {
      setTimeout(() => {
        if (toast) toast.style.display = 'none';
      }, 5000);
    }
  }

  window.saveActiveVariantFromWeb = async function () {
    const item = state.activeEditingItem;
    const model = state.selectedModel;
    if (!item || !model) {
      showAdminToast('Veuillez sélectionner un article à modifier.', 'error');
      return;
    }

    const editColor = document.getElementById('webEditColor')?.value.trim();
    const editSize = document.getElementById('webEditSize')?.value.trim();
    const editRef = document.getElementById('webEditRef')?.value.trim();
    const editPrice = parseFloat(document.getElementById('webEditPrice')?.value) || 0;
    const editStock = parseInt(document.getElementById('webEditStock')?.value, 10);

    if (!editColor) {
      showAdminToast('Le nom de la couleur est obligatoire.', 'error');
      return;
    }
    if (isNaN(editStock) || editStock < 0) {
      showAdminToast('Veuillez spécifier une quantité de stock valide (0 ou plus).', 'error');
      return;
    }

    const btn = document.getElementById('saveVariantWebBtn');
    if (btn) btn.disabled = true;
    showAdminToast('Enregistrement en direct sur Firebase...', 'info');

    try {
      const patchPayload = {
        color: editColor,
        size: editSize || 'Standard',
        reference: editRef || model.reference,
        price: editPrice > 0 ? editPrice : model.price,
        stock: editStock,
        quantity: editStock,
        updatedAt: new Date().toISOString()
      };

      const res = await fetch(`https://l-oreal-capitol-default-rtdb.firebaseio.com/products/${item.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload)
      });

      if (!res.ok) throw new Error('Erreur HTTP ' + res.status);

      showAdminToast(`✓ Déclinaison enregistrée : ${editColor} (Taille ${editSize || 'Std'}, ${editStock} unités) !`, 'success');

      // Recharger le catalogue en temps réel
      await loadCatalogData(true);

      const normC = normalizeColor(editColor);
      const updatedModel = state.groupedModels.find(m => m.name.toLowerCase() === model.name.toLowerCase());
      if (updatedModel) {
        window.openProductModal(updatedModel.modelKey);
        window.selectModalColor(normC);
      }
    } catch (err) {
      console.error('Erreur sauvegarde déclinaison:', err);
      showAdminToast('Échec de la sauvegarde : ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.addNewVariantFromWeb = async function () {
    const model = state.selectedModel;
    if (!model) {
      showAdminToast('Aucun modèle sélectionné.', 'error');
      return;
    }

    const newColor = document.getElementById('webNewColor')?.value.trim();
    const newSize = document.getElementById('webNewSize')?.value.trim();
    const newStock = parseInt(document.getElementById('webNewStock')?.value, 10);
    const newStore = document.getElementById('webNewStore')?.value || 'falaise';

    if (!newColor) {
      showAdminToast('Veuillez renseigner le nom de la nouvelle couleur.', 'error');
      return;
    }
    if (isNaN(newStock) || newStock < 1) {
      showAdminToast('Veuillez spécifier au moins 1 unité en stock.', 'error');
      return;
    }

    const btn = document.getElementById('addVariantWebBtn');
    if (btn) btn.disabled = true;
    showAdminToast('Ajout de la nouvelle déclinaison sur Firebase...', 'info');

    try {
      const postPayload = {
        name: model.name,
        category: model.category,
        reference: model.reference,
        color: newColor,
        size: newSize || 'Standard',
        price: model.price,
        stock: newStock,
        quantity: newStock,
        store: newStore,
        createdAt: new Date().toISOString()
      };

      const res = await fetch(`https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload)
      });

      if (!res.ok) throw new Error('Erreur HTTP ' + res.status);

      showAdminToast(`✓ Déclinaison ajoutée avec succès : ${newColor} (Taille ${newSize || 'Std'}, ${newStock} unités) !`, 'success');

      const cInp = document.getElementById('webNewColor');
      const sInp = document.getElementById('webNewSize');
      if (cInp) cInp.value = '';
      if (sInp) sInp.value = '';

      // Recharger le catalogue en temps réel
      await loadCatalogData(true);

      const normC = normalizeColor(newColor);
      const updatedModel = state.groupedModels.find(m => m.name.toLowerCase() === model.name.toLowerCase());
      if (updatedModel) {
        window.openProductModal(updatedModel.modelKey);
        window.selectModalColor(normC);
      }
    } catch (err) {
      console.error('Erreur ajout déclinaison:', err);
      showAdminToast("Échec de l'ajout : " + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  function sendWhatsAppOrder(model, storeInfo, colorName, variant) {
    const selectedColor = colorName || model.selectedColor || 'Noir';
    const varData = variant || model.colorsList.find(c => c.colorName === selectedColor) || model.colorsList[0];
    const sizes = (varData && varData.sizesArray.length > 0) ? varData.sizesArray.join(', ') : 'Standard';

    const text = 
      `*Bonjour Maison L'Oréal Capitol (${storeInfo.shortName}),*\n\n` +
      `Je souhaite *réserver dès maintenant* ce modèle pour essayage en boutique :\n\n` +
      `⚜️ *Modèle :* ${model.name}\n` +
      `🏷️ *Réf :* ${model.reference}\n` +
      `📂 *Catégorie :* ${model.category}\n` +
      `🎨 *Teinte souhaitée :* ${selectedColor}\n` +
      `📏 *Pointures / Tailles disponibles en ${selectedColor} :* ${sizes}\n` +
      `💰 *Prix :* ${formatPrice(model.price)} FCFA\n` +
      `📍 *Showroom :* ${storeInfo.name} (${storeInfo.address})\n\n` +
      `Pouvez-vous me confirmer sa mise de côté pour mon passage ? Merci !`;

    const encoded = encodeURIComponent(text);
    const waUrl = `https://wa.me/${storeInfo.waNumber}?text=${encoded}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  // ==========================================================================
  // 14. ÉVÉNEMENTS GLOBAUX & NEWSLETTER
  // ==========================================================================
  function initEventHandlers() {
    if (el.storeSelect) {
      el.storeSelect.addEventListener('change', (e) => {
        state.activeStore = e.target.value;
        applyFilters();
      });
    }

    if (el.searchInput) {
      el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (el.clearSearchBtn) {
          el.clearSearchBtn.classList.toggle('visible', !!state.searchQuery);
        }
        applyFilters();
      });
    }

    if (el.clearSearchBtn) {
      el.clearSearchBtn.addEventListener('click', () => {
        el.searchInput.value = '';
        state.searchQuery = '';
        el.clearSearchBtn.classList.remove('visible');
        applyFilters();
      });
    }

    if (el.categorySelect) {
      el.categorySelect.addEventListener('change', (e) => {
        state.activeCategory = e.target.value;
        applyFilters();
      });
    }

    if (el.sizeSelect) {
      el.sizeSelect.addEventListener('change', (e) => {
        state.activeSize = e.target.value;
        applyFilters();
      });
    }

    if (el.loadMoreBtn) {
      el.loadMoreBtn.addEventListener('click', () => {
        state.page++;
        renderProducts();
      });
    }

    if (el.modalCloseBtn) {
      el.modalCloseBtn.addEventListener('click', closeProductModal);
    }
    if (el.productModal) {
      el.productModal.addEventListener('click', (e) => {
        if (e.target === el.productModal) closeProductModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.imageZoomModal && el.imageZoomModal.style.display !== 'none') {
          window.closeImageZoom();
        } else if (el.photoActionModal && el.photoActionModal.style.display !== 'none') {
          closePhotoActionModal();
        } else if (el.productModal && el.productModal.style.display !== 'none') {
          closeProductModal();
        } else {
          window.closeAllOverlays();
        }
      }
    });
  }

  function initNewsletter() {
    if (!el.newsletterForm) return;
    el.newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = el.newsletterForm.querySelector('input[type="email"]');
      if (input && input.value.trim() !== '') {
        el.newsletterForm.innerHTML = `
          <p style="font-size: 13px; color: var(--gold-primary); font-weight: 500; padding: 10px 0; width: 100%;">
            ✓ Merci pour votre inscription. Vous recevrez en exclusivité les nouveaux arrivages de la Maison.
          </p>
        `;
      }
    });
  }

  function initIntersectionReveal() {
    const targets = document.querySelectorAll('.hero-content, .service-card, .zegna-store-card, .catalog-header');
    targets.forEach(el => el.classList.add('reveal-item'));

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    targets.forEach(el => obs.observe(el));
  }

  function formatPrice(val) {
    return Number(val || 0).toLocaleString('fr-FR');
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
