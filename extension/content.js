(function() {
  'use strict';

  console.log('[ShopHub Scraper] Content script loaded and active.');

  // Configuration
  const BACKEND_API = 'http://localhost:5000/api/products/scraped';
  const SCROLL_DELAY = 150; // ms between scrolls
  const SCROLL_STEP = 250;  // px per scroll step
  const MAX_SCROLLS = 30;   // prevent infinite scrolling
  const MAX_PAGES = 5;      // limit auto-navigation depth to prevent runaway scraping

  // Check navigation history to prevent infinite pagination loops
  let pageCount = parseInt(sessionStorage.getItem('sh_scraped_pages') || '0', 10);

  // Helper: Resolve relative URL to absolute
  function resolveUrl(url) {
    if (!url) return null;
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  // Helper: Try to parse numbers from price text
  function cleanPrice(priceText) {
    if (!priceText) return 0;
    // Strip currencies, commas, etc. Keep digits and decimal points.
    const match = priceText.replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
  }

  // 1. Detect products using JSON-LD metadata
  function detectJsonLdProducts() {
    const products = [];
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        
        function traverse(obj) {
          if (!obj || typeof obj !== 'object') return;

          if (obj['@type'] === 'Product' || obj['type'] === 'Product') {
            const name = obj.name;
            let price = 0;
            let product_link = resolveUrl(obj.url) || window.location.href;
            let image_url = null;

            if (obj.offers) {
              const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
              const firstOffer = offers[0];
              if (firstOffer) {
                price = parseFloat(firstOffer.price) || cleanPrice(firstOffer.price);
              }
            }

            if (obj.image) {
              if (Array.isArray(obj.image)) {
                image_url = obj.image[0];
              } else if (typeof obj.image === 'object') {
                image_url = obj.image.url;
              } else {
                image_url = obj.image;
              }
            }

            if (name) {
              products.push({
                name,
                price: price || 0,
                image_url: resolveUrl(image_url),
                product_link,
                description: obj.description || `Scraped via JSON-LD from ${window.location.hostname}.`,
                category: obj.category || 'Scraped Products'
              });
            }
          }

          // Search nested objects / arrays
          if (Array.isArray(obj)) {
            obj.forEach(traverse);
          } else {
            Object.values(obj).forEach(traverse);
          }
        }

        traverse(data);
      } catch (err) {
        // Suppress parsing errors for unrelated scripts
      }
    });

    return products;
  }

  // 2. Detect products using DOM-based heuristics
  function detectDomProducts() {
    const products = [];
    
    // Find potential price elements: any tag with numbers accompanied by $, ₹, €, £
    const priceRegex = /([$₹€£]|Rs\.?)\s?\d+(?:,\d{3})*(?:\.\d{2})?/gi;
    const elements = document.querySelectorAll('body *');
    
    // To identify unique product boxes, search for common container tags
    const productContainers = document.querySelectorAll(
      '[class*="product" i], [class*="item" i], [class*="card" i], [id*="product" i], li, article'
    );

    productContainers.forEach(container => {
      // Ensure the container actually has a price inside it
      const text = container.textContent || '';
      const matches = text.match(priceRegex);
      if (!matches) return;

      // Check if this container is nested within another product container we already processed
      if (products.some(p => p._element && p._element.contains(container))) {
        return;
      }

      // Try to find product details inside this container
      // A. Title
      let name = '';
      const headers = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title" i], [class*="name" i]');
      if (headers.length > 0) {
        name = headers[0].textContent.trim();
      } else {
        // Fallback to first anchor text that isn't too long or short
        const anchors = container.querySelectorAll('a');
        for (let anchor of anchors) {
          const titleText = anchor.textContent.trim();
          if (titleText.length > 5 && titleText.length < 100) {
            name = titleText;
            break;
          }
        }
      }

      if (!name || name.length < 3) return; // Ignore elements with trivial/missing text

      // B. Price
      const priceVal = cleanPrice(matches[0]);

      // C. Image URL
      let image_url = null;
      const images = container.querySelectorAll('img');
      if (images.length > 0) {
        image_url = images[0].getAttribute('data-src') || images[0].getAttribute('data-lazy-src') || images[0].src;
      }

      // D. Product Link
      let product_link = window.location.href;
      const links = container.querySelectorAll('a');
      if (links.length > 0) {
        product_link = links[0].href;
      }

      products.push({
        name,
        price: priceVal,
        image_url: resolveUrl(image_url),
        product_link: resolveUrl(product_link),
        description: `Scraped via DOM heuristic from ${window.location.hostname}.`,
        category: 'Scraped Products',
        _element: container // temporary helper to filter duplicates
      });
    });

    // Remove duplicates and private helper key
    const seen = new Set();
    const uniqueProducts = [];
    products.forEach(p => {
      const key = `${p.name}-${p.price}`;
      if (!seen.has(key)) {
        seen.add(key);
        delete p._element;
        uniqueProducts.push(p);
      }
    });

    return uniqueProducts;
  }

  // Wait for all images to load completely
  async function waitForImages() {
    const images = Array.from(document.querySelectorAll('img'));
    const promises = images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 2000); // 2s timeout fallback
      });
    });
    await Promise.all(promises);
    console.log('[ShopHub Scraper] Images load verification complete.');
  }

  // Scroll page dynamically to trigger lazy-loaded products/images
  function scrollPage() {
    return new Promise(resolve => {
      let scrollCount = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, SCROLL_STEP);
        scrollCount++;

        // Stop conditions: bottom of the page reached or maximum scroll steps hit
        const isBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50;
        if (isBottom || scrollCount >= MAX_SCROLLS) {
          clearInterval(timer);
          // Scroll back to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(resolve, 800); // Allow top position to stabilize
        }
      }, SCROLL_DELAY);
    });
  }

  // Search and click "Next" page or "Load More" buttons
  function handlePagination() {
    if (pageCount >= MAX_PAGES) {
      console.log('[ShopHub Scraper] Reached maximum page pagination limit.');
      sessionStorage.removeItem('sh_scraped_pages'); // Reset
      return false;
    }

    // Heuristics to find "Next Page" or "Load More"
    const buttons = Array.from(document.querySelectorAll('a, button, span'));
    
    // 1. "Load More" buttons (which load content dynamically on the same page)
    const loadMoreKeywords = ['load more', 'show more', 'view more', 'more products'];
    const loadMoreButton = buttons.find(btn => {
      const txt = btn.textContent.toLowerCase().trim();
      return loadMoreKeywords.some(keyword => txt.includes(keyword)) && btn.offsetWidth > 0 && btn.offsetHeight > 0;
    });

    if (loadMoreButton) {
      console.log('[ShopHub Scraper] Clicking "Load More" button:', loadMoreButton.textContent.trim());
      loadMoreButton.click();
      
      // Since it's dynamic loading, wait 3 seconds and rerun scroll + scrape on this same page
      setTimeout(async () => {
        await scrollPage();
        await waitForImages();
        const newProducts = collectAndPostProducts();
        console.log(`[ShopHub Scraper] Load More complete. Found ${newProducts.length} new items.`);
      }, 3000);
      
      return true;
    }

    // 2. "Next Page" links (which navigate to a new page)
    const nextKeywords = ['next', 'next page', '>', '»', 'forward'];
    const nextButton = buttons.find(btn => {
      const txt = btn.textContent.toLowerCase().trim();
      // Must be visible, short text or exact keyword matches
      return nextKeywords.some(keyword => txt === keyword || txt.includes(keyword)) && 
             btn.offsetWidth > 0 && btn.offsetHeight > 0 && 
             (btn.tagName === 'A' || btn.closest('a') || btn.tagName === 'BUTTON');
    });

    if (nextButton) {
      console.log('[ShopHub Scraper] Navigating to next page:', nextButton.textContent.trim());
      pageCount++;
      sessionStorage.setItem('sh_scraped_pages', pageCount);
      
      if (nextButton.click) {
        nextButton.click();
      } else {
        nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      return true;
    }

    return false;
  }

  // Core collection and POST sending logic
  function collectAndPostProducts() {
    const jsonLdProducts = detectJsonLdProducts();
    const domProducts = detectDomProducts();
    
    // Combine lists, preferring JSON-LD products for matching names
    const allProducts = [...jsonLdProducts];
    domProducts.forEach(dp => {
      if (!allProducts.some(jp => jp.name.toLowerCase() === dp.name.toLowerCase())) {
        allProducts.push(dp);
      }
    });

    if (allProducts.length === 0) {
      console.log('[ShopHub Scraper] No products detected on this page.');
      return [];
    }

    console.log(`[ShopHub Scraper] Detected ${allProducts.length} unique products. Saving to database...`);
    
    // Post to backend API
    fetch(BACKEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ products: allProducts })
    })
    .then(res => res.json())
    .then(data => {
      console.log('[ShopHub Scraper] Ingestion Response:', data.message);
    })
    .catch(err => {
      console.error('[ShopHub Scraper] Failed to post products to backend API:', err.message);
    });

    return allProducts;
  }

  // Automate orchestration flow
  async function runScraperFlow() {
    console.log('[ShopHub Scraper] Autoscrolling page to trigger lazy loads...');
    await scrollPage();
    
    console.log('[ShopHub Scraper] Ensuring all images are loaded...');
    await waitForImages();

    console.log('[ShopHub Scraper] Scanning for products...');
    collectAndPostProducts();

    console.log('[ShopHub Scraper] Check pagination...');
    const hasMore = handlePagination();
    if (!hasMore) {
      // Clear pagination counter when we reach the end
      sessionStorage.removeItem('sh_scraped_pages');
    }
  }

  // Run automatically when window is fully loaded
  if (document.readyState === 'complete') {
    runScraperFlow();
  } else {
    window.addEventListener('load', runScraperFlow);
  }

})();
