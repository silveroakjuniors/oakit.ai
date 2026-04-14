'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Search, Plus, Edit2, Trash2, Shield, Mail, Phone } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge, PremiumGrid } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'super-admin';
  phone?: string;
  active: boolean;
  createdAt: string;
}

export default function AdminUsersPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'' | 'admin' | 'teacher' | 'super-admin'>('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      // Fetch users from API
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setUsers(await response.json());
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    if (role === 'super-admin') return 'error';
    if (role === 'admin') return 'primary';
    return 'neutral';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="User Management"
        subtitle="Manage teachers and admin users"
        icon="👥"
        action={
          <PremiumButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            Add User
          </PremiumButton>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl mx-auto space-y-6">
        {/* Search and Filters */}
        <PremiumCard>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{ focusRingColor: palette.primary }}
                />
              </div>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as any)}
                className="px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
                style={{ focusRingColor: palette.primary }}
              >
                <option value="">All Roles</option>
                <option value="super-admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
          </div>
        </PremiumCard>

        {/* Users Grid */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <PremiumCard>
            <div className="p-8 sm:p-12 text-center">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-neutral-600 text-sm">No users found</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map(user => (
              <PremiumCard key={user.id} className="hover:shadow-md transition-all">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-bold text-neutral-900">{user.name}</h3>
                        <PremiumBadge label={user.role} variant={getRoleBadgeColor(user.role) as any} size="sm" />
                        {user.active ? (
                          <PremiumBadge label="Active" variant="success" size="sm" />
                        ) : (
                          <PremiumBadge label="Inactive" variant="neutral" size="sm" />
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-neutral-500">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4 text-neutral-500" />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              </PremiumCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
