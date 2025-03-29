require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const app = express();

// Enable CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001']
}));
app.use(bodyParser.json());
app.use(express.json());

// 🔹 Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 PostgreSQL Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },  // Required for Railway PostgreSQL
});

// Test the database connection
pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
    } else {
        console.log("✅ Connected to PostgreSQL at:", res.rows[0].now);
    }
});

// Start the server
app.listen(4001, () => {
    console.log("🚀 Server is running on port 4000");
});

// Basic Route
app.get("/", (req, res) => {
    res.send("Hello World");
});

// 🔹 Fetch a User's Birthday
app.get("/birthday/:id", async (req, res) => {
    const userId = req.params.id;
    console.log(`🔎 Fetching birthday for ID: ${userId}`);

    try {
        const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

        if (result.rows.length === 0) {
            console.warn("⚠️ No birthday found for ID:", userId);
            return res.status(404).json({ message: "Birthday not found" });
        }

        console.log("✅ Birthday found:", result.rows[0]);
        res.json(result.rows[0]);

    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// 🔹 Multer File Upload (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🔹 API Endpoint to Insert Data with Image
app.post("/submit", upload.single("image"), async (req, res) => {
    try {
        console.log("📩 Request received at /submit");
        console.log("📝 Request Body:", req.body);
        console.log("📷 File:", req.file);

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

                // ✅ Save Data to PostgreSQL
                try {
                    await pool.query(
                        "INSERT INTO users (name, message, image) VALUES ($1, $2, $3)",
                        [name, message, result.secure_url]
                    );
                    console.log("✅ Wish saved successfully!");
                    res.json({ success: true, message: "Wish saved!", image: result.secure_url });

                } catch (dbError) {
                    console.error("❌ PostgreSQL Insert Error:", dbError);
                    res.status(500).json({ error: "Database error" });
                }
            }
        ).end(file.buffer);

    } catch (error) {
        console.error("❌ Unexpected Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



