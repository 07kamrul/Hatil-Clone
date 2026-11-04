import { AdminUser } from '../core/admin-auth';
import { filterUsers, initials, passwordError } from './users';

const user = (over: Partial<AdminUser>): AdminUser => ({
  id: 1, email: 'admin@example.com', full_name: 'Ada Admin', role: 'admin', is_active: true, last_login_at: '2026-01-01T10:00:00Z', created_at: '2025-01-01T00:00:00Z',
  ...over,
});

const USERS: AdminUser[] = [
  user({}),
  user({ id: 2, email: 'boss@example.com', full_name: 'Bo Boss', role: 'super_admin', is_active: false }),
  user({ id: 3, email: 'hana@example.com', full_name: 'Hana Hossain', role: 'admin', is_active: true }),
];

describe('admin users helpers', () => {
  it('validates the password only when required', () => {
    expect(passwordError('short', false)).toContain('8');
    expect(passwordError('', false)).toContain('8');
    expect(passwordError('', true)).toBeNull();
    expect(passwordError('longenough1', false)).toBeNull();
  });

  it('filters by query, role and status', () => {
    expect(filterUsers(USERS, 'hana', 'all', 'all')).toHaveLength(1);
    expect(filterUsers(USERS, 'EXAMPLE', 'all', 'all')).toHaveLength(3); // case-insensitive
    expect(filterUsers(USERS, '', 'super_admin', 'all')).toHaveLength(1);
    expect(filterUsers(USERS, '', 'all', 'inactive')).toHaveLength(1);
    expect(filterUsers(USERS, '', 'admin', 'inactive')).toHaveLength(0);
    expect(filterUsers(USERS, '   ', 'all', 'all')).toHaveLength(3);
  });

  it('builds initials from names and emails', () => {
    expect(initials('Ada Admin')).toBe('AA');
    expect(initials('hana@example.com')).toBe('HE');
    expect(initials('   ')).toBe('?');
  });
});
