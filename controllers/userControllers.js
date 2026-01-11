import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js"

// Example controller function
export const createUser = async (req, res) => {
    try {
        // Validate required fields
        const { email, firstName, lastName, password } = req.body;

        if (!email || !firstName || !lastName || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            email: email,
            firstName: firstName,   // FIXED: req.bofy → req.body
            lastName: lastName,
            password: hashedPassword
        });

        await user.save();

        return res.json({
            message: "User created successfully"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Failed to create user"
        });
    }
};

export function loginUser(req,res){
    if(req.user==null){
        res.status(401).json({
            message:"please login and try again"
        }

        )
        return
    }
    if(req.user.role!="admin"){
        res.status(403).json({
            message:"you must be an admin to create a user"
        })
        return
    }

    user.findOne(
        {
            email:req.body.email
        }
    ).then(


        (user)=>{
            if(user==null){
                res.status(404).json(
                    {
                        message:"User not found"
                    }
                )
            } else{
                const isPasswordMatching=bycrypt.compareSync(req.body.password,user.password)
                const token=jwt.sign(
                    {
                        email:user.email,
                        firstName:user.firstName,
                        lastName:user.lastName,
                        role:user.role,
                        isEmailVerified:user.isEmailVerified
                    
                    },
                    "jwt-secret"
                )
                res.json(
                    {
                        message:"login successul",
                        token:token               
                }
            )
                if(isPasswordMatching){
                    res.status(401).json(
                        {
                            message:"Login successfull",
                        }
                    )
                } else{
                    res.json(
                        {
                            message:"Invalid password"
                        }
                    )
                }
            }
        }
    )



}
export function isAdmin(req){
    if(req.user==null){
        return false;
    }
    if (req.user.role!="admin"){
        return false
    }
    return true;
}

          


  
