import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:ftpconnect/ftpconnect.dart';
import 'package:path_provider/path_provider.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'proxy_server.dart';
import 'database_helper.dart';
import 'settings_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Waiting Print Proxy',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> with WidgetsBindingObserver {
  static const platform = MethodChannel('com.example.waitingpos_agent/permission');
  
  late final ProxyServer _server;
  String _ipAddress = 'Checking...';
  bool _isRunning = false;
  List<String> _logs = [];
  final DatabaseHelper _dbHelper = DatabaseHelper();
  double? _uploadProgress;
  Map<String, dynamic>? _lastJob;

  bool _allPermissionsGranted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _server = ProxyServer(onLog: _addLog);
    _loadLogs();
    _loadLastJob();
    _init();
    _checkPermissionStatus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkPermissionStatus();
    }
  }

  Future<void> _checkPermissionStatus() async {
    final overlay = await Permission.systemAlertWindow.isGranted;
    final battery = await Permission.ignoreBatteryOptimizations.isGranted;
    setState(() {
      _allPermissionsGranted = overlay && battery;
    });
  }

  Future<void> _openSystemPermissionSettings() async {
    try {
      await platform.invokeMethod('openAutostartSettings');
    } on PlatformException catch (e) {
      openAppSettings();
    }
  }

  Future<void> _launchWaitingPage() async {
    final urlString = await SettingsService.getWaitingUrl();
    final Uri url = Uri.parse(urlString);
    try {
      if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw Exception('Could not launch $url');
      }
    } catch (e) {
      _addLog('❌ [LAUNCH ERROR]: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Launch failed: $e')),
        );
      }
    }
  }

  Future<void> _loadLogs() async {
    final logs = await _dbHelper.getLogs();
    setState(() {
      _logs = logs.map((e) => e['message'] as String).toList();
    });
  }

  Future<void> _loadLastJob() async {
    final job = await _dbHelper.getLastPrintJob();
    setState(() {
      _lastJob = job;
    });
  }

  void _addLog(String message) {
    if (!mounted) return;
    setState(() {
      _logs.insert(0, message);
      if (_logs.length > 500) {
        _logs.removeLast();
      }
    });
    if (message.contains('✅ Data sent successfully')) {
      _loadLastJob();
    }
  }

  Future<void> _init() async {
    WakelockPlus.enable();
    final info = NetworkInfo();
    final wifiIp = await info.getWifiIP();
    setState(() {
      _ipAddress = wifiIp ?? 'Unknown IP';
    });
    _toggleServer();
  }

  Future<void> _toggleServer() async {
    if (_isRunning) {
      await _server.stop();
    } else {
      await _server.start();
    }
    setState(() {
      _isRunning = _server.isRunning;
    });
  }

  Future<void> _reprintLastJob() async {
    if (_lastJob == null) return;
    try {
      final ip = _lastJob!['ip'];
      final port = _lastJob!['port'];
      final data = _lastJob!['data'] as List<int>;
      _addLog('🔄 [REPRINT] Attempting to reprint last job...');
      await _server.reprint(ip, port, data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reprint request sent successfully')),
        );
      }
    } catch (e) {
      _addLog('❌ [REPRINT ERROR]: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reprint failed: $e')),
        );
      }
    }
  }

  Future<void> _sendLogFile() async {
    final storeName = await SettingsService.getStoreName();
    final agentInfo = await SettingsService.getAgentInfo();
    final ftpAddr = await SettingsService.getFtpAddr();

    if (storeName.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please set Store Name in Settings first.')),
        );
      }
      return;
    }

    setState(() => _uploadProgress = 0.0);

    try {
      final logs = await _dbHelper.getLogs();
      final logContent = logs.map((e) => "${e['timestamp']} ${e['message']}").join('\n');
      final tempDir = await getTemporaryDirectory();
      final fileName = "log_${storeName}_${DateFormat('yyyyMMdd_HHmmss').format(DateTime.now())}.txt";
      final file = File('${tempDir.path}/$fileName');
      String header = "Store Name: $storeName\nAgent Info: $agentInfo\nGenerated: ${DateTime.now()}\n\n";
      await file.writeAsString(header + logContent);

      FTPConnect ftp = FTPConnect(ftpAddr, port: 2100, user: 'bongs', pass: 'Nice0512', timeout: 30);
      await ftp.connect();
      try { await ftp.changeDirectory('docker3/log_server'); } catch (e) { }
      await ftp.uploadFile(file, onProgress: (p, t, s) => setState(() => _uploadProgress = p / 100));
      await ftp.disconnect();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Logs uploaded successfully')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally {
      setState(() => _uploadProgress = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Waiting Proxy'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.upload),
            onPressed: _uploadProgress != null ? null : _sendLogFile,
            tooltip: 'Send Logs',
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () async {
              await Navigator.push(context, MaterialPageRoute(builder: (context) => const SettingsPage()));
              _checkPermissionStatus();
            },
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          if (_uploadProgress != null) LinearProgressIndicator(value: _uploadProgress),
          if (!_allPermissionsGranted) _buildPermissionBanner(),
          const SizedBox(height: 10),
          _buildStatusHeader(),
          
          // 대기접수 바로가기 버튼 추가
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            child: SizedBox(
              width: double.infinity,
              height: 60,
              child: FilledButton.icon(
                onPressed: _launchWaitingPage,
                icon: const Icon(Icons.touch_app, size: 28),
                label: const Text('WaitingPos 대기접수 실행', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.orange.shade700,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ),

          if (_lastJob != null) _buildReprintBanner(),
          const Divider(),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Icon(Icons.list_alt, size: 18),
                SizedBox(width: 8),
                Text('Real-time Logs', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 10),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListView.builder(
                itemCount: _logs.length,
                itemBuilder: (context, index) => Text(
                  _logs[index],
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                OutlinedButton.icon(
                  onPressed: () => setState(() => _logs.clear()),
                  icon: const Icon(Icons.clear_all),
                  label: const Text('Clear View'),
                ),
                FilledButton.icon(
                  onPressed: _toggleServer,
                  icon: Icon(_isRunning ? Icons.stop : Icons.play_arrow),
                  label: Text(_isRunning ? 'Stop Server' : 'Start Server'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionBanner() {
    return Container(
      width: double.infinity,
      color: Colors.red.shade50,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.security, color: Colors.red, size: 20),
              SizedBox(width: 8),
              Text('권한 설정 확인 필요', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
            ],
          ),
          const Text(
            '첨부된 이미지와 같이 아래 항목을 "Accept(허용)"으로 설정해야 앱이 정상 작동합니다.',
            style: TextStyle(fontSize: 12),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _openSystemPermissionSettings,
              icon: const Icon(Icons.settings_applications),
              label: const Text('권한 설정 화면 바로가기 (Accept로 변경)'),
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusHeader() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.circle, size: 12, color: _isRunning ? Colors.green : Colors.red),
            const SizedBox(width: 8),
            Text(_isRunning ? 'SERVER RUNNING' : 'SERVER STOPPED', 
              style: TextStyle(fontWeight: FontWeight.bold, color: _isRunning ? Colors.green : Colors.red)),
          ],
        ),
        const SizedBox(height: 4),
        Text('Server IP: $_ipAddress', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildReprintBanner() {
    return Container(
      margin: const EdgeInsets.all(10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Row(
        children: [
          const Icon(Icons.print, color: Colors.blue),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('최근 출력 정보', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text(_lastJob!['waiting_info'] ?? '정보 없음', style: const TextStyle(fontSize: 12)),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: _reprintLastJob,
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white),
            child: const Text('재출력'),
          ),
        ],
      ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _storeNameController = TextEditingController();
  final _agentInfoController = TextEditingController();
  final _ftpAddrController = TextEditingController();
  final _waitingUrlController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    _storeNameController.text = await SettingsService.getStoreName();
    _agentInfoController.text = await SettingsService.getAgentInfo();
    _ftpAddrController.text = await SettingsService.getFtpAddr();
    _waitingUrlController.text = await SettingsService.getWaitingUrl();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('환경 설정')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('기본 정보', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 10),
              TextField(controller: _storeNameController, decoration: const InputDecoration(labelText: '매장명', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextField(controller: _agentInfoController, decoration: const InputDecoration(labelText: '에이전트 정보 (예: 테블릿1)', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextField(controller: _ftpAddrController, decoration: const InputDecoration(labelText: '로그 서버 FTP 주소', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextField(controller: _waitingUrlController, decoration: const InputDecoration(labelText: '대기접수 페이지 URL', border: OutlineInputBorder())),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    await SettingsService.saveSettings(
                      _storeNameController.text, 
                      _agentInfoController.text, 
                      _ftpAddrController.text,
                      _waitingUrlController.text,
                    );
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('설정이 저장되었습니다.')));
                      Navigator.pop(context);
                    }
                  },
                  child: const Text('설정 저장'),
                ),
              ),
              const SizedBox(height: 40),
              const Divider(),
              const Text('시스템 특수 권한', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.settings_applications, color: Colors.blue),
                title: const Text('권한 관리 화면 열기'),
                subtitle: const Text('Autostart / Floating Window 설정을 확인하세요.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => const MethodChannel('com.example.waitingpos_agent/permission').invokeMethod('openAutostartSettings'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
