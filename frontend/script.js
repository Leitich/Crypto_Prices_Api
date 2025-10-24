const API_URL = "http://localhost:4000/api/prices";

async function fetchPrices() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    const tableBody = document.querySelector("#pricesTable tbody");
    tableBody.innerHTML = "";

    data.forEach(row => {   
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.name}</td>
        <td>${row.symbol}</td>
        <td>$${parseFloat(row.price_usd).toFixed(2)}</td>
        <td>${new Date(row.last_updated).toLocaleString()}</td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error fetching prices:", error);
  }
}

// Fetch immediately, then every 30 seconds
fetchPrices();
setInterval(fetchPrices, 30000);
