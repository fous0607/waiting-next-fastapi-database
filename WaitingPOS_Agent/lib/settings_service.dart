import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  static const String _keyStoreName = 'store_name';
  static const String _keyAgentInfo = 'agent_info';
  static const String _keyFtpAddr = 'ftp_addr';

  static Future<void> saveSettings(String storeName, String agentInfo, String ftpAddr) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyStoreName, storeName);
    await prefs.setString(_keyAgentInfo, agentInfo);
    await prefs.setString(_keyFtpAddr, ftpAddr);
  }

  static Future<String> getStoreName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyStoreName) ?? '';
  }

  static Future<String> getAgentInfo() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyAgentInfo) ?? '';
  }

  static Future<String> getFtpAddr() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyFtpAddr) ?? '220.121.241.49';
  }
}
