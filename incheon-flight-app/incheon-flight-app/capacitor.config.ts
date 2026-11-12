import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'kr.co.incheonairport.flightstatus',
  appName: '인천공항 운항현황',
  webDir: 'public',
  server: { androidScheme: 'https' }
};
export default config;
