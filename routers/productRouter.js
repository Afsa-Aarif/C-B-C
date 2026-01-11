import express from 'express';

import {
  createProduct,
  deleteProduct,

  updateProduct,
  getProductID,
  postProductID

} from "../controllers/productControllers.js";


const productRouter=express.Router();
productRouter.post("/",createProduct);
productRouter.put("/:productID",updateProduct);
productRouter.get("/:productID",getProductID);
productRouter.delete("/:productID",deleteProduct);
productRouter.post("/:productID",postProductID);

export default productRouter;
