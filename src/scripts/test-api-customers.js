const http = require("http");

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/api/customers?page=1&limit=1",
  method: "GET",
  headers: {
    Authorization:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MjgxMTk4MTR9.abc123",
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const response = JSON.parse(data);
      console.log("✅ API Response:");
      console.log(JSON.stringify(response, null, 2));

      if (response.pagination) {
        console.log("\n📊 Pagination Details:");
        console.log(`   total: ${response.pagination.total}`);
        console.log(`   totalItems: ${response.pagination.totalItems}`);
        console.log(`   page: ${response.pagination.page}`);
        console.log(`   limit: ${response.pagination.limit}`);
        console.log(`   pages: ${response.pagination.pages}`);
      }
    } catch (e) {
      console.error("Error parsing response:", e.message);
      console.log("Raw data:", data);
    }
  });
});

req.on("error", (error) => {
  console.error("Request error:", error.message);
});

req.end();
