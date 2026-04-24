import React, { useState } from 'react';
import { View, Text, TextInput, Button, SafeAreaView, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      Alert.alert('Login failed', e?.message || 'Check credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
      <Text style={{fontSize:20, marginBottom:12}}>Sign in</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={{width:'100%',padding:8,borderWidth:1,borderRadius:6,marginBottom:8}} autoCapitalize='none' />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{width:'100%',padding:8,borderWidth:1,borderRadius:6,marginBottom:12}} />
      <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={submit} disabled={loading} />
    </SafeAreaView>
  );
}
