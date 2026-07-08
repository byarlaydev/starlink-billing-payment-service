'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useFormValidation, InputError } from '@/hooks/useFormValidation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { errors, handleBlur, handleChange, validateAll } = useFormValidation({
    email: { required: 'Email is required', pattern: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email'] },
    password: { required: 'Password is required', minLength: [6, 'Password must be at least 6 characters'] },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll({ email, password })) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      setAuth(res.data.data);
      toast.success('Login successful');
      router.push('/dashboard');
    } catch {
      toast.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 to-primary-700">
      <div className="bg-card rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-foreground opacity-50 mt-2">
            Independent Third-Party Billing Assistance
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); handleChange('email', e.target.value); }}
              onBlur={() => handleBlur('email', email)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="admin@example.com"
            />
            <InputError error={errors.email} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); handleChange('password', e.target.value); }}
              onBlur={() => handleBlur('password', password)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Enter your password"
            />
            <InputError error={errors.password} />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-xs text-foreground opacity-40 text-center mt-6">
          Not affiliated with Starlink or SpaceX
        </p>
      </div>
    </div>
  );
}
