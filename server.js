// Cargar dependencias
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta para obtener productos de Printful con categorías, precios y rating por defecto
app.get('/api/products', async (req, res) => {
  try {
    // Obtener todos los productos de Printful
    const productResponse = await axios.get('https://api.printful.com/store/products', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
      }
    });

    const products = productResponse.data.result;

    // Crear un arreglo de promesas para obtener detalles de cada producto
    const productDetailsPromises = products.map(async (product) => {
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

      // Obtener la categoría del producto usando el `main_category_id`
      let category = 'Unknown'; // Valor por defecto en caso de que falle la petición de categoría
      try {
        const categoryResponse = await axios.get(`https://api.printful.com/categories/${categoryId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
          }
        });
        category = categoryResponse.data.result.title; // Obtener el título de la categoría
      } catch (categoryError) {
        console.error(`Error fetching category for categoryId ${categoryId}:`, categoryError.message);
      }

      // Devolver los datos mapeados a la estructura esperada por el frontend
      return {
        id: productId,
        title: product.name,
        price: price,
        description: productDetails.name, // Puedes ajustar este campo según lo que esperes
        category: category, // La categoría obtenida a partir del main_category_id
        image: productDetails.product.image,
        rating: {
          rate: 0,  // Valor predeterminado
          count: 0  // Valor predeterminado
        }
      };
    });

    // Esperar a que todas las promesas se resuelvan
    const productsWithCategories = await Promise.all(productDetailsPromises);

    // Enviar los productos con detalles y categorías al frontend
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
