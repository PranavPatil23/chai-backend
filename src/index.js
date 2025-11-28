import dotenv from 'dotenv';
import connetDB from './db/index.js';

dotenv.config({
    path:'./.env'
})

connetDB();















/*
import express from 'express';
const app = express();

( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

        // application.on("error",(error) =>{ //this block of code is for when application is not able to working or have some problem to connet to DB as DB connetion is working.
        //     console.log("Error",error);
        //     throw error;
            
        // });

        app.listen(process.env.PORT,() =>{
            console.log(`Application is running on port ${process.env.PORT} `);
            
        })
    } catch (error) {
        console.log("connection failed",error)
        throw error
    }
})()

*/