import axios from "axios";

async function test() {
  const endpoints = ['/api/tool/info', '/api/tool/user', '/api/user', '/api/tool/launch', '/api/tool/balance'];
  for (const ep of endpoints) {
    try {
      const res = await axios.post(`http://aibigtree.com${ep}`, { userId: "123", toolId: "123" });
      console.log(`Success ${ep}:`, res.data);
    } catch(e) {
      console.log(`Fail ${ep}:`, e.response?.data || e.message);
    }
  }
}

test();
