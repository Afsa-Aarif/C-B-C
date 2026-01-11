import mongoose from "mongoose";

    const productSchema=new mongoose.Schema({
        productID:{
            type:String,
            required:true,
            unique:true
        },
        name:{
            type:String,
            required:true
    
        },
        altName:{
            type:[String],
            default:[],
            required:true
        },
        description:{
            type:String,
            required:true  
        },
        images:{
            type:[String],
            default: [],
            required:true
    
        },
        price:{
            type:Number,
            required:true
        },
        labelledPrice:{
            type:Number,
            required:true
        },
        category:{
            type:String,
            required:true
        }
    });
    
    
    
    const product= mongoose.model("product",productSchema);
    export default product



    
