import Product from "../models/product.js"; 

// 1. GET ALL PRODUCTS
export async function getProducts(req, res) {
  try {
    const products = await Product.find(); 
    res.status(200).json({ products });
  } catch (err) {
    console.error("Retrieve All Error:", err.message);
    res.status(500).json({ message: "Failed to retrieve products" });
  }
}

// 2. GET SINGLE PRODUCT BY ID
export async function getProductByID(req, res) {
  try {
    const { id } = req.params; 
    
    if (id.length !== 24) {
       return res.status(400).json({ message: "Invalid Product ID format" });
    }

    const foundProduct = await Product.findById(id);
    if (!foundProduct) {
      return res.status(404).json({ message: "Product not found in database" });
    }
    
    res.status(200).json({ product: foundProduct });
  } catch (err) {
    console.error("Error retrieving product:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

// 3. CREATE PRODUCT
export async function createProduct(req, res) {
  try {
    // Collect non-file text parameters
    const productData = { ...req.body };

    // Parse the trust badges features back into an array safely if passed as stringified JSON
    if (typeof productData.features === "string") {
      try {
        productData.features = JSON.parse(productData.features);
      } catch (e) {
        productData.features = productData.features.split(",").map(f => f.trim());
      }
    }

    // Convert numeric strings into real JavaScript numbers so MongoDB validation passes
    if (productData.price) productData.price = Number(productData.price);
    if (productData.labelledPrice) productData.labelledPrice = Number(productData.labelledPrice);
    if (productData.stock) productData.stock = Number(productData.stock);

    // Map the local backend file uploads to complete public target asset URLs
    if (req.files && req.files.length > 0) {
      productData.images = req.files.map(file => {
        // Generates an accessible URL like: http://localhost:5000/uploads/filename.jpg
        return `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
      });
    }

    const newProduct = new Product(productData); 
    await newProduct.save();

    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (err) {
    console.error("Creation Error:", err.message);
    res.status(500).json({ message: "Failed to create product", error: err.message });
  }
}

// 4. UPDATE PRODUCT
export async function updateProduct(req, res) {
  try {
    const { id } = req.params; 
    const updateData = { ...req.body };

    if (typeof updateData.features === "string") {
      try {
        updateData.features = JSON.parse(updateData.features);
      } catch (e) {
        updateData.features = updateData.features.split(",").map(f => f.trim());
      }
    }

    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.labelledPrice) updateData.labelledPrice = Number(updateData.labelledPrice);
    if (updateData.stock) updateData.stock = Number(updateData.stock);

    // If new image files are uploaded during update, add them to data payload
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => {
        return `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true 
    });
    
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Product updated successfully",
      product: updatedProduct
    });
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// 5. DELETE PRODUCT 
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params; 
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).json({ message: "Failed to delete product" });
  }
}