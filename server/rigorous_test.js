const axios = require('axios');

const API_URL = 'http://localhost:5001/api';
const ITERATIONS = 10;

async function runTests(iteration) {
  console.log(`--- Iteration ${iteration + 1} ---`);
  try {
    // 1. Health Check
    const health = await axios.get('http://localhost:5001/health');
    console.log('✅ Health Check:', health.status);

    // 2. Auth Test (Login)
    const login = await axios.post(`${API_URL}/auth/login`, {
      email: 'demo@agency.com',
      password: 'password123'
    });
    console.log('✅ Login successful');
    const token = login.data.token;
    const agencyId = login.data.agency.id;

    const headers = { Authorization: `Bearer ${token}` };

    // 3. CRM Funnel Test
    const funnel = await axios.get(`${API_URL}/crm/${agencyId}/funnel`, { headers });
    console.log('✅ CRM Funnel:', funnel.data.funnel.length, 'stages');

    // 4. Leads List Test
    const leads = await axios.get(`${API_URL}/crm/${agencyId}/leads`, { headers });
    console.log('✅ CRM Leads:', leads.data.leads.length, 'leads retrieved');

    // 5. Dashboard Overview Test
    const overview = await axios.get(`${API_URL}/dashboard/${agencyId}/overview`, { headers });
    console.log('✅ Dashboard Overview:', overview.status);

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) console.error('Error Body:', error.response.data);
    return false;
  }
}

async function main() {
  let successes = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const success = await runTests(i);
    if (success) successes++;
    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\nFinal Result: ${successes}/${ITERATIONS} successful iterations`);
  process.exit(successes === ITERATIONS ? 0 : 1);
}

main();
