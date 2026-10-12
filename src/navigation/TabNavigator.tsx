import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { CalendarScreen } from '../screens/app/calendar/CalendarScreen';
import { HomeScreen } from '../screens/app/home/HomeScreen';
import { LibraryScreen } from '../screens/app/library/LibraryScreen';
import { ProfileScreen } from '../screens/app/profile/ProfileScreen';
import { StatisticsScreen } from '../screens/app/statistics/StatisticsScreen';
import { colors } from '../theme/colors';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: keyof TabParamList; title: string; icon: IconName; component: () => React.JSX.Element }[] = [
  { name: 'Home', title: 'Inicio', icon: 'home-outline', component: HomeScreen },
  { name: 'Library', title: 'Biblioteca', icon: 'library-outline', component: LibraryScreen },
  { name: 'Calendar', title: 'Calendario', icon: 'calendar-outline', component: CalendarScreen },
  { name: 'Statistics', title: 'Estadísticas', icon: 'stats-chart-outline', component: StatisticsScreen },
  { name: 'Profile', title: 'Mi espacio', icon: 'person-outline', component: ProfileScreen },
];

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      {TABS.map(({ name, title, icon, component }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title,
            tabBarIcon: ({ color, size }) => <Ionicons name={icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
