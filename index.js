require("dotenv").config();
const express = require('express');
const cors = require('cors');
const mySql = require('mysql2');
const bodyParser = require("body-parser");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const app = express();
app.use(cors({
    origin: ['http://localhost:3000','http://localhost:3001']
}
));
app.use(bodyParser.json());

//  Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
app.use(express.json());
const db = mySql.createConnection({
    user:'root',
    host:'localhost',
    password:'0000',
    database:'birthday'
});
db.connect((err) => {
    if (err) {
        console.error("Database connection failed: " + err.stack);
        return;
    }
    console.log("Connected to MySQL");
});
app.listen(4000,()=>{
    console.log('Server is running on port 4000');
});
app.get("/", (req, res) => {
    res.send("Hello World");
})
app.get("/birthday/:id", (req, res) => {
    const userId = req.params.id;
    console.log(`Received request for birthday ID: ${userId}`);

    db.query("SELECT * FROM users WHERE id = ?", [userId], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (result.length === 0) {
            console.warn("Birthday not found for ID:", userId);
            return res.status(404).json({ message: "Birthday not found" });
        }
        console.log("Birthday found:", result[0]);
        res.json(result[0]);
    });
});
//  Setup Multer (Handles File Upload)
const storage = multer.memoryStorage(); // Store file in memory before upload
const upload = multer({ storage });

//  API Endpoint to Insert Data with Image
app.post("/submit", upload.single("image"), async (req, res) => {
    try {
        console.log("Request received at /submit-wish");
        console.log("Request Body:", req.body);
        console.log("File:", req.file);

        const { name, message } = req.body;
        const file = req.file;

        if (!file) {
            console.error("❌ No image uploaded");
            return res.status(400).json({ error: "No image uploaded" });
        }

        // ✅ Upload image to Cloudinary
        cloudinary.uploader.upload_stream(
            { folder: "birthday_wishes" },
            async (error, result) => {
                if (error) {
                    console.error("❌ Cloudinary Upload Error:", error);
                    return res.status(500).json({ error: "Image upload failed" });
                }

                console.log("✅ Cloudinary Upload Success:", result.secure_url);

                // ✅ Save Data to MySQL
                const sql = "INSERT INTO users (name, message, image) VALUES (?, ?, ?)";
                db.query(sql, [name, message, result.secure_url], (err) => {
                    if (err) {
                        console.error("❌ MySQL Insert Error:", err);
                        return res.status(500).json({ error: "Database error" });
                    }
                    console.log("✅ Wish saved successfully!");
                    res.json({ success: true, message: "Wish saved!", image: result.secure_url });
                });
            }
        ).end(file.buffer);
        // res.status(200).json({ message: "Request received successfully" });

    } catch (error) {
        console.error("❌ Unexpected Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


