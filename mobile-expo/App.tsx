import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Button, SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import LoginScreen from './src/screens/LoginScreen';

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }: any) {
  const { signOut } = useAuth();
  return (
    <SafeAreaView style={{flex:1,alignItems:'center',justifyContent:'center'}}>
      <Text style={{fontSize:20, marginBottom:12}}>SOJ Mobile</Text>
      <Button title="Parent Settings" onPress={() => navigation.navigate('Settings')} />
      <Button title="Emergency Contacts" onPress={() => navigation.navigate('Emergency')} />
      <Button title="Sign out" onPress={() => signOut()} />
    </SafeAreaView>
  );
}

function SettingsScreen() {
  return (
    <SafeAreaView style={{flex:1,alignItems:'center',justifyContent:'center'}}>
      <Text>Parent Settings (placeholder)</Text>
    </SafeAreaView>
  );
}

function EmergencyScreen() {
  return (
    <SafeAreaView style={{flex:1,alignItems:'center',justifyContent:'center'}}>
      <Text>Emergency Contacts (placeholder)</Text>
    </SafeAreaView>
  );
}

function AppInner() {
  const { accessToken, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {accessToken ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Emergency" component={EmergencyScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
