import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import crypto from 'crypto';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000'; // Assume server is running

describe('Splitmaro API Integration Tests', () => {
  let token: string;
  let userId: string;
  let groupId: string = crypto.randomUUID();
  let expenseId: string = crypto.randomUUID();

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'password123';

  test('POST /auth/signup - should create a new user', async () => {
    const res = await request(API_URL)
      .post('/auth/signup')
      .send({
        name: 'Test User',
        email: testEmail,
        password: testPassword
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    token = res.body.token;
    userId = res.body.user.id;
  });

  test('POST /auth/login - should authenticate user', async () => {
    const res = await request(API_URL)
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/sync/push - should sync new data', async () => {
    const now = Date.now();
    const res = await request(API_URL)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        groups: [{
          id: groupId,
          name: 'Test Group',
          category: 'travel',
          created_at: now,
          updated_at: now
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
          created_at: now,
          updated_at: now
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
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/sync/pull - should retrieve synced data', async () => {
    const res = await request(API_URL)
      .get('/api/sync/pull?lastSync=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groups.some((g: any) => g.id === groupId)).toBe(true);
    expect(res.body.data.expenses.some((e: any) => e.id === expenseId)).toBe(true);
  });

  test('GET /api/sync/pull - should return empty for future lastSync', async () => {
    const future = Date.now() + 100000;
    const res = await request(API_URL)
      .get(`/api/sync/pull?lastSync=${future}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expenses.length).toBe(0);
  });

  describe('POST /auth/social', () => {
    const socialEmailNew = `social-new-${Date.now()}@example.com`;
    const socialEmailExisting = testEmail; // already registered standard user

    test('should create a new social user with null password_hash', async () => {
      const res = await request(API_URL)
        .post('/auth/social')
        .send({
          idToken: `mock-${socialEmailNew}`,
          email: socialEmailNew,
          name: 'Social User New',
          provider: 'google'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(socialEmailNew);
      expect(res.body.user.password_hash).toBeNull();
    });

    test('should reconcile and log in an existing standard user with matching email', async () => {
      const res = await request(API_URL)
        .post('/auth/social')
        .send({
          idToken: `mock-${socialEmailExisting}`,
          email: socialEmailExisting,
          name: 'Social User Reconciled',
          provider: 'apple'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(socialEmailExisting);
      // It should keep the existing name or keep the existing password_hash
      expect(res.body.user.password_hash).toBeDefined();
      expect(res.body.user.id).toBe(userId);
    });

    test('should fail if email or name is missing', async () => {
      const res = await request(API_URL)
        .post('/auth/social')
        .send({
          provider: 'google'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Referral System Integration Tests', () => {
    let referrerId: string;
    let referrerToken: string;
    const referrerEmail = `referrer-${Date.now()}@example.com`;
    const referrerPassword = 'password123';

    test('should create a referrer user', async () => {
      const res = await request(API_URL)
        .post('/auth/signup')
        .send({
          name: 'Referrer User',
          email: referrerEmail,
          password: referrerPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      referrerToken = res.body.token;
      referrerId = res.body.user.id;
    });

    test('should fetch initial referral stats showing 0 referrals', async () => {
      const res = await request(API_URL)
        .get('/api/referrals/stats')
        .set('Authorization', `Bearer ${referrerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.referralCode).toBe(referrerId);
      expect(res.body.isPro).toBe(false);
      expect(res.body.referralCount).toBe(0);
      expect(res.body.referredUsers.length).toBe(0);
    });

    test('should capture referral code on signup and associate referred_by', async () => {
      const newEmail = `referred-1-${Date.now()}@example.com`;
      const res = await request(API_URL)
        .post('/auth/signup')
        .send({
          name: 'Referred User 1',
          email: newEmail,
          password: 'password123',
          referralCode: referrerId
        });

      expect(res.status).toBe(200);
      expect(res.body.user.referred_by).toBe(referrerId);
    });

    test('should capture referral code on social signup', async () => {
      const newEmail = `referred-social-${Date.now()}@example.com`;
      const res = await request(API_URL)
        .post('/auth/social')
        .send({
          idToken: `mock-${newEmail}`,
          email: newEmail,
          name: 'Social Referred User',
          provider: 'google',
          referralCode: referrerId
        });

      expect(res.status).toBe(200);
      expect(res.body.user.referred_by).toBe(referrerId);
    });

    test('should show referralCount = 2 in referral stats', async () => {
      const res = await request(API_URL)
        .get('/api/referrals/stats')
        .set('Authorization', `Bearer ${referrerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.referralCount).toBe(2);
      expect(res.body.referredUsers.length).toBe(2);
      expect(res.body.isPro).toBe(false);
    });

    test('should automatically upgrade referrer to Pro on the 3rd successful referral', async () => {
      const newEmail = `referred-3-${Date.now()}@example.com`;
      const res = await request(API_URL)
        .post('/auth/signup')
        .send({
          name: 'Referred User 3',
          email: newEmail,
          password: 'password123',
          referralCode: referrerId
        });

      expect(res.status).toBe(200);
      expect(res.body.user.referred_by).toBe(referrerId);

      // Verify the referrer is upgraded to Pro
      const statsRes = await request(API_URL)
        .get('/api/referrals/stats')
        .set('Authorization', `Bearer ${referrerToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.referralCount).toBe(3);
      expect(statsRes.body.isPro).toBe(true);
    });

    test('should log a free referral purchase in the referrer history', async () => {
      const historyRes = await request(API_URL)
        .get('/api/payment/history')
        .set('Authorization', `Bearer ${referrerToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.length).toBe(1);
      expect(historyRes.body[0].provider).toBe('referral');
      expect(historyRes.body[0].amount).toBe(0);
      expect(historyRes.body[0].status).toBe('success');
    });
  });

  describe('Purchase History Integration Tests', () => {
    let buyerToken: string;
    let buyerId: string;
    const buyerEmail = `buyer-${Date.now()}@example.com`;

    test('should fetch empty purchase history initially', async () => {
      // Create new user
      const signupRes = await request(API_URL)
        .post('/auth/signup')
        .send({
          name: 'Pro Buyer',
          email: buyerEmail,
          password: 'password123'
        });
      buyerToken = signupRes.body.token;
      buyerId = signupRes.body.user.id;

      // Get empty history
      const historyRes = await request(API_URL)
        .get('/api/payment/history')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.length).toBe(0);
    });

    test('should fetch payment config successfully', async () => {
      const configRes = await request(API_URL)
        .get('/api/payment/config');

      expect(configRes.status).toBe(200);
      expect(configRes.body.amount).toBeDefined();
      expect(configRes.body.currency).toBeDefined();
    });

    test('should verify Sandbox payment and record purchase history logs', async () => {
      // Fetch dynamic configurations
      const configRes = await request(API_URL).get('/api/payment/config');
      const expectedAmount = configRes.body.amount;
      const expectedCurrency = configRes.body.currency;

      const paymentRes = await request(API_URL)
        .post('/api/verify-payment')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          razorpay_payment_id: 'pay_mock_' + Math.random().toString(36).substring(2, 10),
          razorpay_order_id: 'order_mock_' + Math.random().toString(36).substring(2, 10),
          razorpay_signature: 'sandbox-sig'
        });

      expect(paymentRes.status).toBe(200);
      expect(paymentRes.body.success).toBe(true);

      // Verify purchase was recorded
      const historyRes = await request(API_URL)
        .get('/api/payment/history')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.length).toBe(1);
      expect(historyRes.body[0].provider).toBe('sandbox');
      expect(historyRes.body[0].amount).toBe(expectedAmount);
      expect(historyRes.body[0].currency).toBe(expectedCurrency);
      expect(historyRes.body[0].status).toBe('success');
    });
  });

  describe('Admin Configuration Integration Tests', () => {
    let adminToken: string;

    test('should prevent standard users from modifying dynamic pricing config', async () => {
      const normalSignup = await request(API_URL)
        .post('/auth/signup')
        .send({
          name: 'Regular Joe',
          email: `joe-${Date.now()}@example.com`,
          password: 'password123'
        });

      const normalToken = normalSignup.body.token;

      const adminConfigRes = await request(API_URL)
        .post('/api/admin/config')
        .set('Authorization', `Bearer ${normalToken}`)
        .send({
          amount: 299,
          currency: 'USD'
        });

      expect(adminConfigRes.status).toBe(403);
      expect(adminConfigRes.body.error).toContain('Access denied');
    });

    test('should automatically assign admin permissions to users with configured admin email', async () => {
      const signupRes = await request(API_URL)
        .post('/auth/signup')
        .send({
          name: 'System Admin',
          email: 'admin@splitmaro.com',
          password: 'admin-password-123'
        });

      if (signupRes.status !== 200) {
        const loginRes = await request(API_URL)
          .post('/auth/login')
          .send({
            email: 'admin@splitmaro.com',
            password: 'admin-password-123'
          });
        adminToken = loginRes.body.token;
        expect(loginRes.body.user.is_admin).toBe(1);
      } else {
        adminToken = signupRes.body.token;
        expect(signupRes.body.user.is_admin).toBe(1);
      }
    });

    test('should allow authenticated admin to dynamically update upgrade price and currency', async () => {
      const updateRes = await request(API_URL)
        .post('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 799,
          currency: 'EUR'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      // Verify config was updated dynamically
      const configRes = await request(API_URL).get('/api/payment/config');
      expect(configRes.status).toBe(200);
      expect(configRes.body.amount).toBe(799);
      expect(configRes.body.currency).toBe('EUR');
    });
  });
});
