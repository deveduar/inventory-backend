// Cargar dependencias
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta para obtener productos de Printful con categorías, precios, rating por defecto y nuevo ID secuencial
app.get('/api/products', async (req, res) => {
  try {
    // 1. Obtener todas las categorías de Printful
    const categoryResponse = await axios.get('https://api.printful.com/categories', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
      }
    });

    const categories = categoryResponse.data.result.categories;

    // 2. Obtener todos los productos de Printful
    const productResponse = await axios.get('https://api.printful.com/store/products', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
      }
    });

    const products = productResponse.data.result;

    // 3. Crear un arreglo de promesas para obtener detalles de cada producto
    const productDetailsPromises = products.map(async (product, index) => {
      const productId = product.id;

      // Obtener detalles del producto por ID
      const productDetailResponse = await axios.get(`https://api.printful.com/store/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
        }
      });

      const productDetails = productDetailResponse.data.result.sync_variants[0];
      const categoryId = productDetails.main_category_id;
      const price = productDetails.retail_price;

      // 4. Buscar la categoría por el main_category_id en la lista de categorías obtenidas
      const category = categories.find(cat => cat.id === categoryId)?.title || 'Unknown';

      // Devolver los datos mapeados a la estructura esperada por el frontend
      return {
        id: index + 1, // Generar un nuevo ID secuencial empezando en 1
        title: product.name,
        price: price,
        description: productDetails.name, // Ajustar este campo según lo que esperes
        category: category, // La categoría obtenida a partir del main_category_id
        image: productDetails.product.image,
        rating: {
          rate: 0,  // Valor predeterminado para 'rate'
          count: 0  // Valor predeterminado para 'count'
        }
      };
    });

    // Esperar a que todas las promesas se resuelvan
    const productsWithCategories = await Promise.all(productDetailsPromises);

    // Enviar los productos con detalles, categorías y nuevos IDs al frontend
    res.json(productsWithCategories);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching products and categories from Printful' });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
