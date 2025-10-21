// server.js
import express from 'express';
import mysql from 'mysql2/promise';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// API Key Middleware 
const verifyApiKey = (req, res, next) => {
  const clientKey = req.headers['x-api-key'];

  if (!clientKey || clientKey !== process.env.API_KEY) {
    return res.status(403).json({ error: "Unauthorized: Invalid API key" });
  }

  // Key is valid → move on to next middleware or route
  next();
};

const app = express();
const port = process.env.PORT || 4000;

// 🧩 Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

// 🏠 Home route
app.get("/", (req, res) => {
  res.send("🚀 Crypto Price API is running! Try /api/prices or POST /api/refresh");
});

// 📈 GET - fetch all prices
app.get("/api/prices", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM prices ORDER BY last_updated DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

// 🔄 POST - refresh prices from external API
app.post("/api/refresh", verifyApiKey, async (req, res) => {
  try {
    // Fetch data from CoinGecko
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin&vs_currencies=usd";
    const { data } = await axios.get(url);

    // Prepare records
    const prices = [
      ["Bitcoin", "BTC", data.bitcoin.usd, new Date()],
      ["Ethereum", "ETH", data.ethereum.usd, new Date()],
      ["Dogecoin", "DOGE", data.dogecoin.usd, new Date()]
    ];

    // Insert new records (no truncate → keeps history)
    for (const [name, symbol, price, last_updated] of prices) {
      await pool.query(
        "INSERT INTO prices (name, symbol, price_usd, last_updated) VALUES (?, ?, ?, ?)",
        [name, symbol, price, last_updated]
      );
    }

    res.json({ message: "✅ Prices refreshed successfully", prices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to refresh prices" });
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`✅ Connected to database`);
  console.log(`🚀 API running on http://localhost:${port}`);
});


// 🔄 POST - refresh prices from external API
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
