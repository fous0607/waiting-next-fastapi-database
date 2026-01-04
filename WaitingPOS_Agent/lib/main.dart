import 'dart:io';
import 'package:flutter/material.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:ftpconnect/ftpconnect.dart';
import 'package:path_provider/path_provider.dart';
import 'package:intl/intl.dart';
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

class _MyHomePageState extends State<MyHomePage> {
  late final ProxyServer _server;
  String _ipAddress = 'Checking...';
  bool _isRunning = false;
  List<String> _logs = [];
  final DatabaseHelper _dbHelper = DatabaseHelper();

  @override
  void initState() {
    super.initState();
    _server = ProxyServer(onLog: _addLog);
    _loadLogs();
    _init();
  }

  Future<void> _loadLogs() async {
    final logs = await _dbHelper.getLogs();
    setState(() {
      _logs = logs.map((e) => e['message'] as String).toList();
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

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final logs = await _dbHelper.getLogs();
      final logContent = logs.map((e) => "${e['timestamp']} ${e['message']}").join('\n');
      
      final tempDir = await getTemporaryDirectory();
      final fileName = "log_${storeName}_${DateFormat('yyyyMMdd_HHmmss').format(DateTime.now())}.txt";
      final file = File('${tempDir.path}/$fileName');
      
      String header = "Store Name: $storeName\nAgent Info: $agentInfo\nGenerated: ${DateTime.now()}\n\n";
      await file.writeAsString(header + logContent);

      FTPConnect ftp = FTPConnect(ftpAddr, port: 2100, user: 'bongs', pass: 'Nice0512');

      await ftp.connect();
      try {
        await ftp.changeDirectory('docker3/log_server');
      } catch (e) {
        // Directory might not exist or other error
      }
      
      await ftp.uploadFile(file);
      await ftp.disconnect();

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Logs uploaded successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
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
            onPressed: _sendLogFile,
            tooltip: 'Send Logs to Server',
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsPage()),
              );
              setState(() {}); // Refresh if needed
            },
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          const SizedBox(height: 10),
          _buildStatusHeader(),
          const Divider(),
          const Text('Real-time Logs', style: TextStyle(fontWeight: FontWeight.bold)),
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(8),
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
                ElevatedButton(
                  onPressed: () => setState(() => _logs.clear()),
                  child: const Text('Clear View'),
                ),
                ElevatedButton(
                  onPressed: _toggleServer,
                  child: Text(_isRunning ? 'Stop Server' : 'Start Server'),
                ),
              ],
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
            Text(_isRunning ? 'RUNNING' : 'STOPPED', style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        Text('IP: $_ipAddress', style: const TextStyle(fontSize: 18)),
      ],
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

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    _storeNameController.text = await SettingsService.getStoreName();
    _agentInfoController.text = await SettingsService.getAgentInfo();
    _ftpAddrController.text = await SettingsService.getFtpAddr();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            children: [
              TextField(
                controller: _storeNameController,
                decoration: const InputDecoration(labelText: 'Store Name (매장명)'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _agentInfoController,
                decoration: const InputDecoration(labelText: 'Agent Info (에이전트 정보)'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _ftpAddrController,
                decoration: const InputDecoration(labelText: 'FTP Server Address'),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () async {
                  await SettingsService.saveSettings(
                    _storeNameController.text,
                    _agentInfoController.text,
                    _ftpAddrController.text,
                  );
                  if (mounted) Navigator.pop(context);
                },
                child: const Text('Save Settings'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
