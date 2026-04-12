(function() {
  // Debounce
  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  let currentBrands = [], currentIngredients = [], currentSearch = '', currentPage = 1;
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

  async function fetchAndDisplayProducts(page = 1) {
    console.log('Fetching products with params:', { page, brands: currentBrands, ingredients: currentIngredients, search: currentSearch });
    if (currentController) currentController.abort();
    currentController = new AbortController();
    currentPage = page;

    // disable pagination buttons
    document.querySelectorAll('.pagination button').forEach(btn => btn.disabled = true);

    let url = `/api/filter?page=${page}&limit=${itemsPerPage}`;
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
      html += `
        <div class="product-card">
          <img src="${p.imageUrl || placeholderImage}" onerror="this.onerror=null; this.src='${placeholderImage}';" loading="lazy">
          <h3>${escapeHtml(p.name)}</h3>
          <div class="brand">${escapeHtml(p.brand ? p.brand.name : 'Brand')}</div>
          <div class="price">$${p.price}</div>
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

  // Filters
  const debouncedFilter = debounce(() => {
    currentBrands = Array.from(document.querySelectorAll('.brand-filter:checked')).map(cb => cb.value);
    currentIngredients = Array.from(document.querySelectorAll('.ingredient-filter:checked')).map(cb => cb.value);
    resetAndFetch();
  }, 150);

  const brandCheckboxes = document.querySelectorAll('.brand-filter');
  const ingredientCheckboxes = document.querySelectorAll('.ingredient-filter');
  brandCheckboxes.forEach(cb => cb.addEventListener('change', debouncedFilter));
  ingredientCheckboxes.forEach(cb => cb.addEventListener('change', debouncedFilter));

  // Initial fetch – only once
  fetchAndDisplayProducts();

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
