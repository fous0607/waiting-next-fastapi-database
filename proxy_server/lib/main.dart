import 'dart:io';
import 'package:flutter/material.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:ftpconnect/ftpconnect.dart';
import 'proxy_server.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WaitingPOS Agent',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueGrey),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF0F0F0),
      ),
      home: const AgentMainScreen(),
    );
  }
}

class AgentMainScreen extends StatefulWidget {
  const AgentMainScreen({super.key});

  @override
  State<AgentMainScreen> createState() => _AgentMainScreenState();
}

class _AgentMainScreenState extends State<AgentMainScreen> {
  final ProxyServer _server = ProxyServer();
  final List<ServerLog> _logs = [];
  
  bool _isRunning = false;
  String _agentIp = 'Checking...';
  
  // 기본 컨트롤러
  final TextEditingController _posIpController = TextEditingController();
  final TextEditingController _posPortController = TextEditingController();
  final TextEditingController _printerIpController = TextEditingController();
  final TextEditingController _printerPortController = TextEditingController();
  final TextEditingController _logServerUrlController = TextEditingController();
  
  // 환경설정 정보 (매장 및 기기 식별)
  final TextEditingController _storeNameController = TextEditingController();
  String _deviceType = 'Tablet'; // Tablet, Manager_PC, POS
  final List<String> _deviceTypes = ['Tablet', 'Manager_Laptop', 'POS_Terminal'];

  bool _showTxLog = false;
  bool _hideSidebar = false;
  bool _highPriority = false;
  
  String _printerStatusMessage = '검수 대기 중';
  Color _printerStatusColor = Colors.grey;
  bool _isCheckingStatus = false;
  bool _isPrintingTest = false;

  @override
  void initState() {
    super.initState();
    _loadSettings().then((_) => _init());
    
    _server.logStream.listen((log) {
      if (mounted) {
        setState(() {
          _logs.insert(0, log);
          if (_logs.length > 500) _logs.removeLast();
        });
      }
    });
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _posIpController.text = prefs.getString('pos_ip') ?? '127.0.0.1';
      _posPortController.text = prefs.getString('pos_port') ?? '8090';
      _printerIpController.text = prefs.getString('printer_ip') ?? '192.168.0.100';
      _printerPortController.text = prefs.getString('printer_port') ?? '9100';
      _logServerUrlController.text = prefs.getString('log_server_url') ?? '220.121.241.49';
      _storeNameController.text = prefs.getString('store_name') ?? 'Default_Store';
      _deviceType = prefs.getString('device_type') ?? 'Tablet';
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pos_ip', _posIpController.text);
    await prefs.setString('pos_port', _posPortController.text);
    await prefs.setString('printer_ip', _printerIpController.text);
    await prefs.setString('printer_port', _printerPortController.text);
    await prefs.setString('log_server_url', _logServerUrlController.text);
    await prefs.setString('store_name', _storeNameController.text);
    await prefs.setString('device_type', _deviceType);
  }

  Future<void> _init() async {
    try { await WakelockPlus.enable(); } catch (_) {}
    await _refreshIp();
    if (!_isRunning) await _toggleServer();
  }

  Future<void> _refreshIp() async {
    final info = NetworkInfo();
    final wifiIp = await info.getWifiIP();
    setState(() { _agentIp = wifiIp ?? '127.0.0.1'; });
  }

  Future<void> _toggleServer() async {
    try {
      if (_isRunning) {
        await _server.stop();
      } else {
        await _server.start();
      }
    } catch (e) {
      _showSnackBar('서버 오류: $e');
    } finally {
      if (mounted) setState(() { _isRunning = _server.isRunning; });
    }
  }

  // 환경설정 등록 다이얼로그
  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('환경설정 및 기기 등록'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _storeNameController,
                decoration: const InputDecoration(labelText: '매장명 (영문/숫자 권장)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 15),
              DropdownButtonFormField<String>(
                value: _deviceType,
                decoration: const InputDecoration(labelText: '기기 유형', border: OutlineInputBorder()),
                items: _deviceTypes.map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                onChanged: (value) => setModalState(() => _deviceType = value!),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
            ElevatedButton(
              onPressed: () async {
                await _saveSettings();
                Navigator.pop(context);
                _showSnackBar('기기 정보가 등록되었습니다.');
              },
              child: const Text('등록 및 저장'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleLogFtpUpload() async {
    final String host = _logServerUrlController.text;
    final String storeName = _storeNameController.text.trim();
    final String devType = _deviceType;

    if (host.isEmpty || storeName.isEmpty) {
      _showSnackBar('FTP 주소와 매장명을 먼저 등록해주세요.');
      return;
    }

    final appDocDir = await getApplicationDocumentsDirectory();
    final sourceDir = Directory('${appDocDir.path}/logs');
    final files = sourceDir.listSync().whereType<File>().toList();
    if (files.isEmpty) {
      _showSnackBar('전송할 로그 파일이 없습니다.');
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const AlertDialog(
        title: Text('로그 서버 전송'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LinearProgressIndicator(),
            SizedBox(height: 10),
            Text('서버 경로 구조화 및 업로드 중...'),
          ],
        ),
      ),
    );

    FTPConnect ftpConnect = FTPConnect(host, port: 2100, user: 'bongs', pass: 'Nice0512', timeout: 30);
    bool success = false;
    String errorMsg = "";

    try {
      await ftpConnect.connect();
      await ftpConnect.changeDirectory('/docker3/log_server');
      
      // 계층 구조 폴더 생성: /매장명/기기유형_IP/
      try { await ftpConnect.makeDirectory(storeName); } catch (_) {}
      await ftpConnect.changeDirectory(storeName);
      
      String subFolder = "${devType}_${_agentIp.replaceAll('.', '_')}";
      try { await ftpConnect.makeDirectory(subFolder); } catch (_) {}
      await ftpConnect.changeDirectory(subFolder);

      for (var file in files) {
        final fileName = p.basename(file.path);
        await ftpConnect.uploadFile(file, sRemoteName: "${storeName}_${devType}_$fileName");
      }
      success = true;
    } catch (e) {
      errorMsg = e.toString();
    } finally {
      await ftpConnect.disconnect();
      if (mounted) Navigator.pop(context);
    }

    _showResultModal(success, success ? '로그 전송 성공\n경로: /log_server/$storeName/$devType...' : '전송 실패: $errorMsg');
  }

  void _showResultModal(bool success, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(success ? '성공' : '실패'),
        content: Text(message),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('확인'))],
      ),
    );
  }

  Future<void> _checkPrinterConnection() async {
    setState(() {
      _isCheckingStatus = true;
      _printerStatusMessage = '연결 확인 중...';
      _printerStatusColor = Colors.orange;
    });

    final bool isOk = await _server.checkPrinterStatus(
      _printerIpController.text, 
      int.tryParse(_printerPortController.text) ?? 9100
    );

    if (mounted) {
      setState(() {
        _isCheckingStatus = false;
        if (isOk) {
          _printerStatusMessage = '연결 정상 (Online)';
          _printerStatusColor = Colors.green;
        } else {
          _printerStatusMessage = '연결 실패 (Offline)';
          _printerStatusColor = Colors.red;
        }
      });
    }
  }

  Future<void> _handleTestPrint() async {
    setState(() => _isPrintingTest = true);
    try {
      await _server.printTestPage(
        _printerIpController.text,
        int.tryParse(_printerPortController.text) ?? 9100
      );
      _showSnackBar('테스트 페이지를 프린터로 전송했습니다.');
    } catch (e) {
      _showSnackBar('테스트 출력 실패: $e');
    } finally {
      if (mounted) setState(() => _isPrintingTest = false);
    }
  }

  void _showSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    _posIpController.dispose();
    _posPortController.dispose();
    _printerIpController.dispose();
    _printerPortController.dispose();
    _logServerUrlController.dispose();
    _storeNameController.dispose();
    _server.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          if (!_hideSidebar) _buildSidebar(),
          Expanded(
            child: Column(
              children: [
                _buildTopBar(),
                Expanded(child: _buildMainContent()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return Container(
      width: 280,
      color: const Color(0xFFEAEAEA),
      padding: const EdgeInsets.fromLTRB(20, 40, 20, 20), // 상단 여백 추가하여 답답함 해소
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('WaitingPOS Agent', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: -1, color: Color(0xFF222222))),
          const Text('AGENT v1.1.6.0', style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 30), // 하단 요소와의 간격 확장
          
          ElevatedButton(
            onPressed: _toggleServer,
            style: ElevatedButton.styleFrom(
              backgroundColor: _isRunning ? const Color(0xFF888888) : Colors.blue,
              foregroundColor: Colors.white,
              shape: const RoundedRectangleBorder(),
              padding: const EdgeInsets.symmetric(vertical: 15),
            ),
            child: Text(_isRunning ? '서비스 중지' : '서비스 시작', style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 10),
          ElevatedButton(
            onPressed: () => _showSnackBar('데이터 동기화 완료'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF002244),
              foregroundColor: Colors.white,
              shape: const RoundedRectangleBorder(),
              padding: const EdgeInsets.symmetric(vertical: 15),
            ),
            child: const Text('데이터 동기화', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 25),
          
          _buildInputField('WaitingPos 대기자관리 IP', _posIpController, suffixController: _posPortController),
          const SizedBox(height: 12),
          _buildReadOnlyField('AGENT IP', _agentIp),
          const SizedBox(height: 12),
          _buildInputField('PRINTER IP', _printerIpController, suffixController: _printerPortController),
          
          const SizedBox(height: 20),
          const Text('로그 및 전송 관리', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blueGrey)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await _saveSettings();
                    _showSnackBar('설정이 저장되었습니다.');
                  },
                  icon: const Icon(Icons.save, size: 14),
                  label: const Text('저장', style: TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blueGrey, foregroundColor: Colors.white, shape: const RoundedRectangleBorder()),
                ),
              ),
              const SizedBox(width: 5),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _handleLogFtpUpload,
                  icon: const Icon(Icons.cloud_upload, size: 14),
                  label: const Text('로그 전송', style: TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent, foregroundColor: Colors.white, shape: const RoundedRectangleBorder()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _buildInputField('FTP 서버 주소', _logServerUrlController),
          
          const Spacer(),
          Row(
            children: [
              Checkbox(value: _highPriority, onChanged: (v) => setState(() => _highPriority = v!)),
              const Text('프로세스 우선순위 높임', style: TextStyle(fontSize: 12)),
            ],
          ),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: _showSettingsDialog, // 환경설정 팝업 호출
            icon: const Icon(Icons.settings, size: 18),
            label: const Text('환경설정 (매장/기기 등록)'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white, 
              foregroundColor: Colors.black, 
              side: const BorderSide(color: Colors.grey),
              shape: const RoundedRectangleBorder(),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.white,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Row(children: [Checkbox(value: _showTxLog, onChanged: (v) => setState(() => _showTxLog = v!)), const Text('거래 로그 표시')]),
          const SizedBox(width: 20),
          Row(children: [Checkbox(value: _hideSidebar, onChanged: (v) => setState(() => _hideSidebar = v!)), const Text('좌측바 숨기기')]),
        ],
      ),
    );
  }

  Widget _buildMainContent() {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            onTap: (index) {
              if (index == 1) _checkPrinterConnection();
            },
            tabs: const [Tab(text: '실행로그'), Tab(text: '연결상태')],
          ),
          Expanded(
            child: Container(
              color: Colors.white,
              margin: const EdgeInsets.all(16),
              child: TabBarView(
                physics: const NeverScrollableScrollPhysics(),
                children: [_buildLogList(), _buildStatusView()],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogList() {
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: _logs.length,
      itemBuilder: (context, index) {
        final log = _logs[index];
        final timeStr = DateFormat('HH:mm:ss.SSS').format(log.timestamp);
        return Text(
          '[$timeStr] ${log.message}',
          style: TextStyle(
            fontFamily: 'monospace', fontSize: 13,
            color: log.type == 'error' ? Colors.red : (log.type == 'success' ? Colors.blue : Colors.black),
          ),
        );
      },
    );
  }

  Widget _buildStatusView() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('프린터 연결 상태 검수', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(8)),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('대상 프린터:', style: TextStyle(fontSize: 16)),
                    Text('${_printerIpController.text}:${_printerPortController.text}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                ),
                const Divider(height: 30),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('검수 결과:', style: TextStyle(fontSize: 16)),
                    Row(
                      children: [
                        if (_isCheckingStatus) const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2)),
                        const SizedBox(width: 10),
                        Text(_printerStatusMessage, style: TextStyle(color: _printerStatusColor, fontWeight: FontWeight.bold, fontSize: 18)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 30),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: _isCheckingStatus ? null : _checkPrinterConnection,
              icon: const Icon(Icons.refresh),
              label: const Text('재검수 하기'),
            ),
          ),
          const SizedBox(height: 15),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: (_isCheckingStatus || _isPrintingTest) ? null : _handleTestPrint,
              icon: _isPrintingTest 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.print),
              label: const Text('프린터 테스트'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade700,
                foregroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('※ 프린터가 켜져 있고 같은 네트워크(WiFi)에 연결되어 있는지 확인하십시오.', style: TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildInputField(String label, TextEditingController controller, {TextEditingController? suffixController}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blueGrey)),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(flex: 3, child: SizedBox(height: 30, child: TextField(controller: controller, decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 8)), style: const TextStyle(fontSize: 12)))),
            if (suffixController != null) ...[const SizedBox(width: 4), Expanded(flex: 1, child: SizedBox(height: 30, child: TextField(controller: suffixController, decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 8)), style: const TextStyle(fontSize: 12))))]
          ],
        ),
      ],
    );
  }

  Widget _buildReadOnlyField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blueGrey)),
        const SizedBox(height: 4),
        Container(width: double.infinity, height: 30, alignment: Alignment.centerLeft, padding: const EdgeInsets.symmetric(horizontal: 8), decoration: BoxDecoration(color: const Color(0xFFD0D0D0), border: Border.all(color: Colors.grey)), child: Text(value, style: const TextStyle(fontSize: 12))),
      ],
    );
  }
}
