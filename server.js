// server.js
import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "**********",
  database: process.env.DB_NAME || "crypto_db",
});

//  Middleware to verify API key
function verifyApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

//  Home route
app.get("/", (req, res) => {
  res.send("🚀 Crypto Price API is running!");
});

//  Refresh prices (dynamic based on DB)
app.post("/api/refresh", verifyApiKey, async (req, res) => {
  try {
    // 1️⃣ Get active coins
    const [coins] = await pool.query("SELECT * FROM coins WHERE is_active = TRUE");

    if (coins.length === 0) {
      return res.status(400).json({ error: "No active coins found in database." });
    }

    // 2️⃣ Build CoinGecko API request
    const coinIds = coins.map((c) => c.coingecko_id).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`;

    // 3️⃣ Fetch data
    const { data } = await axios.get(url);

    // 4️⃣ Prepare insert data
    const pricesArr = coins.map((c) => [
      c.name,
      c.symbol,
      data[c.coingecko_id]?.usd || 0,
      new Date(),
    ]);

    // 5️⃣ Insert into historical prices
    await pool.query(
      "INSERT INTO prices (name, symbol, price_usd, last_updated) VALUES ?",
      [pricesArr]
    );

    // 6️⃣ Update latest_prices table
    for (const [name, symbol, price, last_updated] of pricesArr) {
      await pool.query(
        `INSERT INTO latest_prices (symbol, name, price_usd, last_updated)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           price_usd = VALUES(price_usd),
           last_updated = VALUES(last_updated)`,
        [symbol, name, price, last_updated]
      );
    }

    console.log("✅ Prices refreshed successfully");
    res.json({ message: "✅ Prices refreshed successfully", updated: pricesArr });
  } catch (err) {
    console.error("❌ Error refreshing prices:", err.message);
    res.status(500).json({ error: "Failed to refresh prices", details: err.message });
  }
});

// ✅ Get all latest prices
app.get("/api/prices", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM latest_prices ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

// ✅ Get all coins (active/inactive)
app.get("/api/coins", async (req, res) => {
  try {
    const [coins] = await pool.query("SELECT * FROM coins ORDER BY name ASC");
    res.json(coins);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch coins" });
  }
});

// ✅ Add a new coin (admin use)
app.post("/api/add-coin", verifyApiKey, async (req, res) => {
  try {
    const { name, symbol, coingecko_id, is_active = true } = req.body;

    if (!name || !symbol || !coingecko_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await pool.query(
      "INSERT INTO coins (name, symbol, coingecko_id, is_active) VALUES (?, ?, ?, ?)",
      [name, symbol, coingecko_id, is_active]
    );

    res.json({ message: `✅ Coin '${name}' added successfully` });
  } catch (err) {
    console.error("❌ Error adding coin:", err.message);
    res.status(500).json({ error: "Failed to add coin", details: err.message });
  }
});

// ✅ Remove a coin by ID (admin use)
app.delete("/api/remove-coin/:id", verifyApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM coins WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Coin not found" });
    }

    res.json({ message: `🗑️ Coin with ID ${id} removed successfully` });
  } catch (err) {
    console.error("❌ Error removing coin:", err.message);
    res.status(500).json({ error: "Failed to remove coin" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));


//  POST - refresh prices from external API
// app.post('/api/refresh', async (req, res) => {
//   try {
//     // Using CoinGecko public API (no API key needed)
//     const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');

//     const data = response.data;
//     const prices = [
//       ['Bitcoin', 'BTC', data.bitcoin.usd],
//       ['Ethereum', 'ETH', data.ethereum.usd],
//       ['Solana', 'SOL', data.solana.usd]
//     ];

//     // Clear old data (optional)
//     await pool.query('DELETE FROM prices');

//     // Insert new prices
//     for (const [name, symbol, price] of prices) {
//       await pool.query('INSERT INTO prices (name, symbol, price_usd) VALUES (?, ?, ?)', [name, symbol, price]);
//     }

//     res.json({ message: '✅ Prices updated', data: prices });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to refresh prices' });
//   }
// });
