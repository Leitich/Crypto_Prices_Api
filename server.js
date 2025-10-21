// server.js
import express from "express";
import axios from "axios";
import db from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 4000;

// Get all stored prices
app.get("/api/prices", (req, res) => {
  db.query("SELECT * FROM prices ORDER BY last_updated DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Fetch latest prices from CoinGecko and store in DB
app.post("/api/refresh", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
    );

    const coins = [
      { name: "Bitcoin", symbol: "BTC", price_usd: data.bitcoin.usd },
      { name: "Ethereum", symbol: "ETH", price_usd: data.ethereum.usd },
    ];

    coins.forEach((coin) => {
      db.query(
        "INSERT INTO prices (name, symbol, price_usd) VALUES (?, ?, ?)",
        [coin.name, coin.symbol, coin.price_usd]
      );
    });

    res.json({ message: "✅ Prices updated", data: coins });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch prices", details: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('🚀 Crypto API is running! Try /api/prices or /api/refresh');
});

app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
