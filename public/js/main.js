(function() {
  // Debounce
  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  let currentBrands = [], currentIngredients = [], currentSearch = '', currentPage = 1, currentSort = 'name_asc';
  const itemsPerPage = 9;
  let currentController = null;

  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23cbd5e1'/%3E%3Ctext x='50%25' y='50%25' font-size='16' fill='%2347565b' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";

  function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const badge = document.getElementById('cartCount');
    if (badge) {
      badge.innerText = totalItems;
      badge.classList.add('pop');
      setTimeout(() => badge.classList.remove('pop'), 100);
    }
  }

  window.updateCartCount = updateCartCount;

  // Load filters from API
  async function loadFilters() {
    try {
      const [brandsRes, ingredientsRes] = await Promise.all([
        fetch('/api/brands'),
        fetch('/api/ingredients')
      ]);
      const brands = await brandsRes.json();
      const ingredients = await ingredientsRes.json();
      
      const brandsHtml = brands.map(b => `<label><input type="checkbox" class="brand-filter" value="${b._id}"> ${escapeHtml(b.name)}</label>`).join('');
      const ingredientsHtml = ingredients.map(i => `<label><input type="checkbox" class="ingredient-filter" value="${i._id}"> ${escapeHtml(i.name)}</label>`).join('');
      
      document.getElementById('brandsContainer').innerHTML += brandsHtml;
      document.getElementById('ingredientsContainer').innerHTML += ingredientsHtml;
      
      // Attach filter listeners after loading
      attachFilterListeners();
    } catch (err) {
      console.error('Failed to load filters', err);
    }
  }

  function attachFilterListeners() {
    const debouncedFilter = debounce(() => {
      currentBrands = Array.from(document.querySelectorAll('.brand-filter:checked')).map(cb => cb.value);
      currentIngredients = Array.from(document.querySelectorAll('.ingredient-filter:checked')).map(cb => cb.value);
      resetAndFetch();
    }, 150);
    document.querySelectorAll('.brand-filter, .ingredient-filter').forEach(cb => {
      cb.removeEventListener('change', debouncedFilter);
      cb.addEventListener('change', debouncedFilter);
    });
  }

  async function fetchAndDisplayProducts(page = 1) {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    currentPage = page;

    document.querySelectorAll('.pagination button').forEach(btn => btn.disabled = true);

    let url = `/api/filter?page=${page}&limit=${itemsPerPage}&sort=${currentSort}`;
    if (currentBrands.length) url += `&brands=${currentBrands.join(',')}`;
    if (currentIngredients.length) url += `&ingredients=${currentIngredients.join(',')}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    try {
      const res = await fetch(url, { signal: currentController.signal });
      const data = await res.json();
      renderProducts(data.products);
      renderPagination(data.currentPage, data.totalPages);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Fetch error:', err);
        const container = document.getElementById('productList');
        if (container) container.innerHTML = '<p>Error loading products. Check console.</p>';
      }
    }
    currentController = null;
    setTimeout(() => {
      document.querySelectorAll('.pagination button').forEach(btn => btn.disabled = false);
    }, 200);
  }

  function renderProducts(products) {
    const container = document.getElementById('productList');
    if (!container) return;
    if (!products.length) {
      container.innerHTML = '<p>No products found</p>';
      return;
    }
    let html = '<div class="product-grid">';
    for (const p of products) {
      const categoryClass = p.category === 'cosmetic' ? 'cosmetic' : 'supplement';
      const categoryLabel = p.category === 'cosmetic' ? '💄 Cosmetic' : '💊 Supplement';
      let priceHtml = `<div class="price">${p.finalPrice} IQD</div>`;
      if (p.discountPercent > 0) {
        priceHtml = `<div class="price"><span style="text-decoration: line-through; font-size:0.8rem;">${p.originalPrice} IQD</span> ${p.finalPrice} IQD (${p.discountPercent}% off)</div>`;
      }
      html += `
        <div class="product-card">
          <img src="${p.imageUrl || placeholderImage}" onerror="this.onerror=null; this.src='${placeholderImage}';" loading="lazy">
          <h3>${escapeHtml(p.name)}</h3>
          <div class="brand">${escapeHtml(p.brand ? p.brand.name : 'Brand')}</div>
          ${priceHtml}
          <div class="ingredients"><small>🔹 ${p.ingredients ? p.ingredients.map(i => escapeHtml(i.name)).join(', ') : ''}</small></div>
          <div class="category-badge ${categoryClass}">${categoryLabel}</div>
          <button onclick="addToCart('${p._id}')">🛒 Add to cart</button>
        </div>
      `;
    }
    html += '</div>';
    requestAnimationFrame(() => {
      container.innerHTML = html;
    });
  }

  function renderPagination(currentPage, totalPages) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;
    if (totalPages <= 1) {
      paginationDiv.innerHTML = '';
      return;
    }
    let html = '<div class="pagination">';
    if (currentPage > 1) html += `<button data-page="${currentPage - 1}">◀ Prev</button>`;
    html += `<span>Page ${currentPage} of ${totalPages}</span>`;
    if (currentPage < totalPages) html += `<button data-page="${currentPage + 1}">Next ▶</button>`;
    html += '</div>';
    paginationDiv.innerHTML = html;
    document.querySelectorAll('.pagination button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(btn.dataset.page);
        if (!isNaN(page)) fetchAndDisplayProducts(page);
      });
    });
  }

  function resetAndFetch() {
    currentPage = 1;
    fetchAndDisplayProducts(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const debouncedSearch = debounce(() => {
      currentSearch = searchInput.value;
      resetAndFetch();
    }, 300);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // Sorting
  const sortSelect = document.getElementById('sortBy');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      resetAndFetch();
    });
  }

  function initFilterCollapse() {
    const filterContent = document.querySelector('.filter-content');
    const toggleIcon = document.querySelector('.toggle-icon');
    if (!filterContent) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      filterContent.style.display = 'none';
      if (toggleIcon) toggleIcon.textContent = '▲';
    } else {
      filterContent.style.display = 'block';
      if (toggleIcon) toggleIcon.textContent = '▼';
    }
  }

  function initDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let stored = localStorage.getItem('darkMode');
    if (stored === null) {
      stored = prefersDark ? 'enabled' : 'disabled';
    }
    const toggle = document.getElementById('darkModeToggle');
    if (stored === 'enabled') {
      document.body.classList.add('dark');
      if (toggle) toggle.textContent = '☀️';
    } else {
      document.body.classList.remove('dark');
      if (toggle) toggle.textContent = '🌙';
    }
  }

  function toggleDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    if (document.body.classList.contains('dark')) {
      document.body.classList.remove('dark');
      localStorage.setItem('darkMode', 'disabled');
      if (toggle) toggle.textContent = '🌙';
    } else {
      document.body.classList.add('dark');
      localStorage.setItem('darkMode', 'enabled');
      if (toggle) toggle.textContent = '☀️';
    }
  }

  document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);
  window.addEventListener('resize', debounce(initFilterCollapse, 150));
  initDarkMode();
  initFilterCollapse();

  // Load filters then initial fetch
  loadFilters().then(() => {
    fetchAndDisplayProducts();
  });

  window.addToCart = async (productId) => {
    try {
      const res = await fetch(`/api/product/${productId}`);
      if (!res.ok) throw new Error('Product not found');
      let cart = JSON.parse(localStorage.getItem('cart')) || [];
      const existing = cart.find(item => item.productId === productId);
      if (existing) {
        existing.quantity = (existing.quantity || 0) + 1;
      } else {
        cart.push({ productId, quantity: 1 });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartCount();
      alert('Added to cart');
    } catch (err) {
      alert('Sorry, this product is no longer available.');
    }
  };

  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', async (e) => {
      const lang = e.target.value;
      await fetch('/auth/set-lang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang })
      });
      window.location.reload();
    });
  }

  updateCartCount();
})();
