// routes/settings.lazy.tsx
// import SettingsPage from '@/MyComponents/SettingsPage';
import SettingsPage from '@/MyComponents/Sidebar/SettingsPage';
import { createLazyFileRoute } from '@tanstack/react-router';
// import SettingsPage from '@/components/MyComponents/SettingsPage';

export const Route = createLazyFileRoute('/settings')({
  component: SettingsPage,
});