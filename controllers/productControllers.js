import {isAdmin} from"./userControllers.js";
import product from "../models/product.js";
import productRouter from "../routers/productRouter.js";

/* ===== ✅ ADDED (missing import) ===== */
import productModel from "../models/product.js";
/* =================================== */

export async function createProduct(req,res) {
    if(!isAdmin(req)){
        res.status(403).json({
            message:"You are not authorized to create a product"
        });
        return;
    }
    try{
        const productData=req.body;
        const product=new product(productData);
        await product.save();
        res.json({
            message:"Product created successfully",
            product:product,
        });
    }catch(err){
        console.error(err);
        res.status(500).json({
            message:"Failed to create product",
        });
    }
}

export async function getProducts(req,res){
    try{
        const product=await product.find()
        res.json(products);

    }catch(err){
        console.error(err);
        res.status(500).json({
            message:"Failed to retrieve products",
        });
    }
}

export async function deleteProduct(req,res){
    if (! isAdmin(req)){
        res.status(403).json({
            message:"You are not authorized to delete Product"
        });
        return;
    }
    try{
        const productID=req.param.productID
        await product.deleteOne({
            productID:productID
        })
        res.json({
            message:"product deleted successfully"
        });

    }catch(err){
        console.error(err);
        res.status(500).json({
            message:"Failed to delete product",
        });
    }
}

export async function updateProduct(req,res){
    if(! isAdmin(req)){
        res.status(403).json({
            message:"You are not authorized to update a product"
        });
        return;
    }
    try{
        const productID=req.params.productID;
        const updateData=req.body;
        await product.updateOne(
            {productID:productID},
            updateData
        );
        res.json({
            message:"Product updated successfully"
        });
    }catch(err){
        console.error(err);
        res.status(500).json({
            message:"Failed to update product",
        });
    }
}

export async function postProduct(req,res){
    try{
        const productID = req.params.productID;

        const product = await productModel.findOne({
            productID: productID
        });
      
        if(product==null){
            res.status(404).json({
                message:"product not find"
            });
        }else{
            res.json(product);
        }
    }catch(err){
        console.error(err);
        res.status(500).json({
            message:"Faleid to retrieve product",
        });
    }
}

/* ===== ✅ ADDED (missing exports for router) ===== */
export { postProduct as postProductID };
export { postProduct as getProductID };
/* =============================================== */
