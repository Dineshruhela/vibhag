import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting API Verification...');
  
  let token = '';
  let userId = '';
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'password123';
  const groupId = uuidv4();
  const expenseId = uuidv4();

  try {
    // 1. Signup
    console.log('📝 Testing Signup...');
    const signupRes = await axios.post(`${API_URL}/auth/signup`, {
      name: 'Test User',
      email: testEmail,
      password: testPassword
    });
    token = signupRes.data.token;
    userId = signupRes.data.user.id;
    console.log('✅ Signup successful');

    // 2. Login
    console.log('🔑 Testing Login...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    if (loginRes.data.token) console.log('✅ Login successful');

    // 3. Sync Push
    console.log('📤 Testing Sync Push...');
    const pushRes = await axios.post(`${API_URL}/api/sync/push`, {
      groups: [{
        id: groupId,
        name: 'Test Group',
        category: 'travel',
        created_at: Date.now(),
        updated_at: Date.now()
      }],
      groupMembers: [{
        group_id: groupId,
        user_id: userId
      }],
      expenses: [{
        id: expenseId,
        group_id: groupId,
        description: 'Test Dinner',
        amount: 1000,
        currency: 'INR',
        created_by: userId,
        created_at: Date.now(),
        updated_at: Date.now()
      }],
      expensePayers: [{
        expense_id: expenseId,
        user_id: userId,
        amount: 1000
      }],
      expenseShares: [{
        expense_id: expenseId,
        user_id: userId,
        share_amount: 1000
      }]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (pushRes.data.success) console.log('✅ Sync Push successful');

    // 4. Sync Pull
    console.log('📥 Testing Sync Pull...');
    const pullRes = await axios.get(`${API_URL}/api/sync/pull?lastSync=0`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const hasGroup = pullRes.data.data.groups.some((g: any) => g.id === groupId);
    const hasExpense = pullRes.data.data.expenses.some((e: any) => e.id === expenseId);
    
    if (hasGroup && hasExpense) {
      console.log('✅ Sync Pull successful (Data verified)');
    } else {
      throw new Error('Sync Pull failed: Data missing');
    }

    // 5. Social Auth (New User)
    console.log('🌐 Testing Social Auth (New)...');
    const socialNewEmail = `social-${Date.now()}@example.com`;
    const socialNewRes = await axios.post(`${API_URL}/auth/social`, {
      idToken: `mock-${socialNewEmail}`,
      name: 'Social Test User',
      email: socialNewEmail,
      provider: 'google'
    });
    if (socialNewRes.data.token && socialNewRes.data.user.password_hash === null) {
      console.log('✅ Social Auth (New) successful');
    } else {
      throw new Error('Social Auth (New) failed: Invalid user/token returned');
    }

    // 6. Social Auth (Existing Reconciled)
    console.log('🔄 Testing Social Auth (Reconciled with standard)...');
    const socialRecRes = await axios.post(`${API_URL}/auth/social`, {
      idToken: `mock-${testEmail}`,
      name: 'Social Reconciled Name',
      email: testEmail,
      provider: 'apple'
    });
    if (socialRecRes.data.token && socialRecRes.data.user.id === userId) {
      console.log('✅ Social Auth (Reconciled) successful');
    } else {
      throw new Error('Social Auth (Reconciled) failed: ID mismatch or token missing');
    }

    console.log('\n✨ ALL TESTS PASSED! API is stable. ✨');
  } catch (error: any) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
