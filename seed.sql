PRAGMA foreign_keys = ON;

-- Ensure current user exists (we don't know the exact UUID but let's assume one is there, we can just insert our own or update the existing one)
-- Wait, the app auto-creates the current user. Let's find their ID and use it.
-- But we can't do logic easily in pure SQL without sqlite3 functions. Instead, let's just insert some friends.
-- Actually, we can use a temporary table or subquery to get the current user ID.

-- Create friends
INSERT INTO users (id, name, avatar_color, is_current_user, created_at) VALUES ('user_1', 'Alice Johnson', '#FF6B6B', 0, 1715000000000);
INSERT INTO users (id, name, avatar_color, is_current_user, created_at) VALUES ('user_2', 'Bob Smith', '#4ECDC4', 0, 1715000000000);
INSERT INTO users (id, name, avatar_color, is_current_user, created_at) VALUES ('user_3', 'Charlie Davis', '#96CEB4', 0, 1715000000000);

-- Create Groups
INSERT INTO groups_ (id, name, category, created_at, updated_at) VALUES ('group_1', 'Goa Trip 2024', 'trip', 1715000000000, 1715000000000);
INSERT INTO groups_ (id, name, category, created_at, updated_at) VALUES ('group_2', 'Apartment Rent', 'home', 1715000000000, 1715000000000);

-- Add Members to Groups
-- We need the current user's ID for group members. Let's assume the user ID is retrieved via subquery
INSERT INTO group_members (group_id, user_id) SELECT 'group_1', id FROM users WHERE is_current_user = 1;
INSERT INTO group_members (group_id, user_id) VALUES ('group_1', 'user_1');
INSERT INTO group_members (group_id, user_id) VALUES ('group_1', 'user_2');

INSERT INTO group_members (group_id, user_id) SELECT 'group_2', id FROM users WHERE is_current_user = 1;
INSERT INTO group_members (group_id, user_id) VALUES ('group_2', 'user_3');

-- Expenses for Group 1 (Goa Trip)
INSERT INTO expenses (id, group_id, description, amount, category, created_by, created_at, updated_at) 
VALUES ('exp_1', 'group_1', 'Flight Tickets', 15000, 'travel', 'user_1', 1715000000000, 1715000000000);

INSERT INTO expense_payers (expense_id, user_id, amount) VALUES ('exp_1', 'user_1', 15000);
INSERT INTO expense_shares (expense_id, user_id, share_amount) SELECT 'exp_1', id, 5000 FROM users WHERE is_current_user = 1;
INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES ('exp_1', 'user_1', 5000);
INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES ('exp_1', 'user_2', 5000);


INSERT INTO expenses (id, group_id, description, amount, category, created_by, created_at, updated_at) 
VALUES ('exp_2', 'group_1', 'Hotel Booking', 12000, 'general', 'user_2', 1715000000000, 1715000000000);

INSERT INTO expense_payers (expense_id, user_id, amount) VALUES ('exp_2', 'user_2', 12000);
INSERT INTO expense_shares (expense_id, user_id, share_amount) SELECT 'exp_2', id, 4000 FROM users WHERE is_current_user = 1;
INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES ('exp_2', 'user_1', 4000);
INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES ('exp_2', 'user_2', 4000);


-- Expenses for Group 2 (Apartment)
INSERT INTO expenses (id, group_id, description, amount, category, created_by, created_at, updated_at) 
SELECT 'exp_3', 'group_2', 'Internet Bill', 1200, 'utilities', id, 1715000000000, 1715000000000 FROM users WHERE is_current_user = 1;

INSERT INTO expense_payers (expense_id, user_id, amount) SELECT 'exp_3', id, 1200 FROM users WHERE is_current_user = 1;
INSERT INTO expense_shares (expense_id, user_id, share_amount) SELECT 'exp_3', id, 600 FROM users WHERE is_current_user = 1;
INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES ('exp_3', 'user_3', 600);

