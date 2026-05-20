import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000'; // Assume server is running

describe('Splitmaro API Integration Tests', () => {
  let token: string;
  let userId: string;
  let groupId: string = uuidv4();
  let expenseId: string = uuidv4();

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
    const now = BigInt(Date.now());
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
});
