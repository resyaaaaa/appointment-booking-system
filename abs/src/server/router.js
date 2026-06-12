import express from "express";
import {sendEmail} from "./services/emailService";

const router = express.Router();

router.post("/send-email", async (requestAnimationFrame, res) => {
    try{
        const {to, subject, body} = req.body;

        const result = await sendEmail({
            to,
            subject,
            html: body.replace(/\n/g, "<br/>"),
        });

        res.json({ success: true, result});
    
    }catch (err) {
        res.status(500).json({ error:err.message});
    }
});

export default router;