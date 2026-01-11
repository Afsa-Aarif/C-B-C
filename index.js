import express from "express";
import mongoose from "mongoose";

/* ===== ✅ ADDED (missing import) ===== */
import jwt from "jsonwebtoken";
/* =================================== */

import userRouter from "./routers/userRouter.js";
import productRouter from "./routers/productRouter.js";

function getUsers(dbPassword){
    const myProise = new Promise(
        (resolve,reject)=>{
            if(dbPassword==""){
                setTimeout(()=>{
                    resolve()
                },5000)
            }else{
                reject({
                    message:"invalid password",
                })
            }
        }
    )

    /* ===== ✅ ADDED (missing variable) ===== */
    const myPromise = myProise;
    /* ===================================== */

    return myPromise
}

/* ===== ✅ ADDED (async wrapper for await) ===== */
(async ()=>{
    try{
        let users=await getUsers("")
        console.log(users)
        console.log("Users fetch successfully")
    } catch(error){
        console.error(error)
        console.error("Error fetching user")
    }
})();
/* ============================================= */

const app = express()

app.use(express.json())
app.use("/users", userRouter)
app.use("/products",productRouter)

app.use(
    (req, res, next) => {
        let token = req.header("Authorization")
        if (token != null) {
            token = token.replace("Bearer ", "")
        }
        console.log(token)

        jwt.verify(token, "jwt-secret",
            (err, decoded) => {
                if (decoded == null) {
                    res.json({
                        message: "invalid token please login again"
                    })
                    return
                } else {
                    req.user = decoded;
                    next();
                }
                console.log(decoded)
            }
        )
    }
)

/* ===== ✅ ADDED (clean connection string) ===== */
const cleanConnectionString =
"mongodb+srv://Afsa:Af16191.@cluster0.ggaur4k.mongodb.net/?appName=Cluster0";
/* ============================================ */

mongoose.connect(cleanConnectionString).then(
    () => { console.log("Database connected successfuly") }
).catch(
    (e) => { 
        console.log(e);
        console.log("Database connection failed") }
)

app.get("/", (req, res) => {
    console.log("Get request received");
    let prefix = "Mr.";
    if (req.body.gender === "female") { prefix = "Ms."; }
    console.log(req.body);
    res.json({
        message: "Hello " + prefix + "  " + req.body.name
    });
});

app.delete("/", (req, res) => {
    console.log("post request received")
})

app.listen(5000, () => {
    console.log("server is started")
})
