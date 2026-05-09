import { redirect } from 'next/navigation';

export default function RegisterPage({ searchParams }: { searchParams?: { inviteCode?: string; redirect?: string } }) {
  const nextSearchParams = new URLSearchParams();
  if (searchParams?.inviteCode) {
    nextSearchParams.set('inviteCode', searchParams.inviteCode);
  }
  if (searchParams?.redirect) {
    nextSearchParams.set('redirect', searchParams.redirect);
  }

  const queryString = nextSearchParams.toString();
  redirect(queryString ? `/login?${queryString}` : '/login');
}
