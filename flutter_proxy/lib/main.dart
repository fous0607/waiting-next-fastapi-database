import 'package:flutter/material.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'proxy_server.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Waiting Print Proxy',
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
  final ProxyServer _server = ProxyServer();
  String _ipAddress = 'Checking...';
  bool _isRunning = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // Keep screen on
    WakelockPlus.enable();
    
    // Get IP
    final info = NetworkInfo();
    final wifiIp = await info.getWifiIP();
    setState(() {
      _ipAddress = wifiIp ?? 'Unknown IP';
    });

    // Auto start
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Waiting Print Proxy (Flutter)'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Icon(Icons.print, size: 100, color: Colors.blue),
            const SizedBox(height: 30),
            Text(
              _isRunning ? 'SERVER RUNNING' : 'SERVER STOPPED',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: _isRunning ? Colors.green : Colors.red,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Proxy IP Address:',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            Text(
              _ipAddress,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold
              ),
            ),
            const SizedBox(height: 50),
            FilledButton.icon(
              onPressed: _toggleServer,
              icon: Icon(_isRunning ? Icons.stop : Icons.play_arrow),
              label: Text(_isRunning ? 'STOP SERVER' : 'START SERVER'),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 20),
              ),
            ),
            const SizedBox(height: 20),
            const Padding(
              padding: EdgeInsets.all(20.0),
              child: Text(
                'Keep this app open on your tablet.\nEnter the IP address above into the Waiting Store Settings.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
