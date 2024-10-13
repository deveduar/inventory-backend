require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Variables de caché
let categoriesCache = null;
let productsCache = {};  // Cambiado a objeto para almacenar productos por ID
let cacheExpirationTime = {}; // Expiración por producto ID
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hora

// Función para obtener las categorías de Printful
async function fetchCategories() {
  if (categoriesCache && Date.now() < categoriesCache.expirationTime) {
    console.log('Usando categorías desde la caché');
    return categoriesCache.data; // Devuelve el caché si aún es válido
  }

  console.log('Solicitando categorías al servidor de Printful');
  const categoryResponse = await axios.get('https://api.printful.com/categories', {
    headers: {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
    }
  });

  categoriesCache = {
    data: categoryResponse.data.result.categories,
    expirationTime: Date.now() + CACHE_DURATION_MS
  };
  return categoriesCache.data;
}

// Función para obtener los detalles de un producto por ID
async function fetchProductDetailsById(productId, categories) {
  // Verificar si el producto está en la caché y aún no ha expirado
  if (productsCache[productId] && Date.now() < cacheExpirationTime[productId]) {
    console.log(`Usando detalles del producto ${productId} desde la caché`);
    return productsCache[productId];
  }

  console.log(`Solicitando detalles del producto ${productId} al servidor de Printful`);
  const productDetailResponse = await axios.get(`https://api.printful.com/store/products/${productId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
    }
  });

  const productSyncVariants = productDetailResponse.data.result.sync_variants;
  const categoryId = productSyncVariants[0].main_category_id;
  const files = productSyncVariants[0].files;

  const frontImage = files.find(file => file.type === 'front')?.preview_url || '';
  const previewImage = files.find(file => file.type === 'preview')?.preview_url || '';
  const category = categories.find(cat => cat.id === categoryId)?.title || 'Unknown';

  const variants = productSyncVariants.map(variant => ({
    id: variant.id,
    name: variant.name,
    size: variant.size,
    price: parseFloat(variant.retail_price),
    sku: variant.sku,
    external_id: variant.external_id,
    color: variant.color
  }));

  const productDetails = {
    id: productId,
    title: productDetailResponse.data.result.sync_product.name,
    description: productSyncVariants[0].name,
    price: parseFloat(productSyncVariants[0].retail_price),
    category: category,
    images: {
      front: frontImage,
      preview: previewImage,
      thumbnail: productDetailResponse.data.result.sync_product.thumbnail_url
    },
    rating: {
      rate: 0,
      count: 0
    },
    sku: productSyncVariants[0].sku,
    currency: productSyncVariants[0].currency,
    color: productSyncVariants[0].color,
    availability_status: productSyncVariants[0].availability_status,
    external_id: productSyncVariants[0].external_id,
    variants: variants
  };

  // Guardar el producto en la caché y establecer la expiración
  productsCache[productId] = productDetails;
  cacheExpirationTime[productId] = Date.now() + CACHE_DURATION_MS;

  return productDetails;
}

// Ruta para obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    if (productsCache.all && Date.now() < cacheExpirationTime.all) {
      console.log('Usando todos los productos desde la caché');
      return res.json(productsCache.all); // Devuelve el caché si aún es válido
    }

    console.log('Solicitando productos al servidor de Printful');
    const categories = await fetchCategories();

    const productResponse = await axios.get('https://api.printful.com/store/products', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
      }
    });

    const products = productResponse.data.result;

    const productDetailsPromises = products.map(product => fetchProductDetailsById(product.id, categories));
    const productsWithCategories = await Promise.all(productDetailsPromises);

    // Guardar todos los productos en la caché y establecer la expiración
    productsCache.all = productsWithCategories;
    cacheExpirationTime.all = Date.now() + CACHE_DURATION_MS;

    res.json(productsWithCategories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching products and categories from Printful' });
  }
});

// Ruta para obtener un producto por ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const categories = await fetchCategories();

    const product = await fetchProductDetailsById(productId, categories);
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching product by ID from Printful' });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
