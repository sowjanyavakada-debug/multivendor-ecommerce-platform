const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const db = require('../database/database');

/**
 * Syncs scraped products from database to scraped_products.json
 * and commits/pushes to the git remote.
 * @param {number} insertedCount Number of newly inserted products
 */
const syncScrapedProducts = async (insertedCount) => {
  try {
    // Fetch all products that have a product_link (indicating they are scraped)
    const products = await db.all('SELECT * FROM Products WHERE product_link IS NOT NULL');
    
    // Resolve project root path
    const projectRoot = path.resolve(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'scraped_products.json');
    
    // Write formatted JSON to file
    await fs.writeFile(filePath, JSON.stringify(products, null, 2), 'utf8');
    console.log(`[Git Sync] Wrote ${products.length} products to scraped_products.json`);

    // Run git commands: add, commit, and push
    const gitCommand = `git add scraped_products.json && git commit -m "Auto-update scraped products - Ingested ${insertedCount}" && git push scraped-repo main`;
    
    exec(gitCommand, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Git Auto-Push Error]:', error);
        return;
      }
      console.log('[Git Auto-Push Success]:', stdout);
      if (stderr) {
        console.log('[Git Auto-Push Info/Stderr]:', stderr);
      }
    });
  } catch (err) {
    console.error('[Git Sync Exception]:', err);
  }
};

module.exports = { syncScrapedProducts };
