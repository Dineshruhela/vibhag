import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={64} color="#1CC29F" />
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#0F1419' },
  title: { fontSize: 18, fontWeight: '600', color: '#F9FAFB', marginTop: 16 },
  link: { marginTop: 16, paddingVertical: 12 },
  linkText: { fontSize: 15, color: '#1CC29F', fontWeight: '600' },
});
