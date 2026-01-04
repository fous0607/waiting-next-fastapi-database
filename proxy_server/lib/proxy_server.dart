import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

class ServerLog {
  final DateTime timestamp;
  final String message;
  final String type; // 'info', 'error', 'success'

  ServerLog({required this.message, this.type = 'info'}) : timestamp = DateTime.now();
}

class ProxyServer {
  HttpServer? _server;
  final int port = 8000;
  int _printCount = 0; // 프린트 순번
  
  final _logController = StreamController<ServerLog>.broadcast();
  Stream<ServerLog> get logStream => _logController.stream;

  void _addLog(String message, {String type = 'info'}) {
    final log = ServerLog(message: message, type: type);
    _logController.add(log);
    _saveLogToFile(log); // 파일에 저장
  }

  // 로그를 파일로 저장하고 오래된 파일 삭제 (30일 보관)
  Future<void> _saveLogToFile(ServerLog log) async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final logDir = Directory('${directory.path}/logs');
      if (!await logDir.exists()) await logDir.create();

      final dateStr = DateFormat('yyyy-MM-dd').format(log.timestamp);
      final file = File('${logDir.path}/log_$dateStr.txt');
      
      final timeStr = DateFormat('HH:mm:ss').format(log.timestamp);
      await file.writeAsString(
        '[$timeStr][${log.type}] ${log.message}\n',
        mode: FileMode.append,
      );

      // 30일 지난 파일 삭제
      _cleanOldLogs(logDir);
    } catch (e) {
      print('Log saving error: $e');
    }
  }

  Future<void> _cleanOldLogs(Directory logDir) async {
    final now = DateTime.now();
    final files = logDir.listSync();
    for (var file in files) {
      if (file is File) {
        final stat = await file.stat();
        if (now.difference(stat.modified).inDays > 30) {
          await file.delete();
        }
      }
    }
  }

  // Start the server
  Future<void> start() async {
    if (_server != null) return;
    final router = Router();

    router.get('/', (Request request) {
      return Response.ok('Waiting Print Proxy is Running!', headers: _corsHeaders);
    });

    router.post('/print', (Request request) async {
      _printCount++;
      final currentNo = _printCount;
      try {
        final payload = await request.readAsString();
        final Map<String, dynamic> body = jsonDecode(payload);
        final String? ip = body['ip'];
        final int port = body['port'] ?? 9100;
        final dynamic dataRaw = body['data'];

        _addLog('[Service] #$currentNo 프린트 요청 수신 (IP: $ip)', type: 'info');

        if (ip == null || dataRaw == null) throw Exception('IP 또는 데이터가 없습니다.');

        final List<int> data = List<int>.from(dataRaw);
        await _sendToPrinter(ip, port, data);

        _addLog('[Service] #$currentNo 프린터 출력 성공', type: 'success');
        return Response.ok(jsonEncode({'status': 'success'}), headers: _corsHeaders);
      } catch (e) {
        _addLog('[Service] #$currentNo 프린터 출력 실패: $e', type: 'error');
        return Response.internalServerError(
          body: jsonEncode({'status': 'error', 'message': e.toString()}),
          headers: _corsHeaders,
        );
      }
    });

    final handler = Pipeline().addMiddleware(logRequests()).addHandler(router.call);
    _server = await shelf_io.serve(handler, InternetAddress.anyIPv4, port);
    _addLog('[Main] AGENT 서버 실행됨 (Port: $port)', type: 'success');
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
    _addLog('[Main] AGENT 서버 중지됨');
  }

  bool get isRunning => _server != null;

  Future<bool> checkPrinterStatus(String ip, int port) async {
    Socket? socket;
    try {
      socket = await Socket.connect(ip, port, timeout: const Duration(seconds: 3));
      return true;
    } catch (_) {
      return false;
    } finally {
      await socket?.close();
    }
  }

  Future<void> printTestPage(String ip, int port) async {
    _printCount++;
    final currentNo = _printCount;
    _addLog('[Service] #$currentNo 테스트 페이지 출력 시도...');
    
    final List<int> testData = [
      ...utf8.encode('\n\n      [ Printer Test #$currentNo ]\n\n'),
      ...utf8.encode('Printer IP: $ip\n'),
      ...utf8.encode('Print Time: ${DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now())}\n'),
      ...utf8.encode('\n프린터 테스트 출력 성공\n\n\n\n\n'),
      0x1D, 0x56, 0x41, 0x00,
    ];

    try {
      await _sendToPrinter(ip, port, testData);
      _addLog('[Service] #$currentNo 테스트 페이지 출력 완료', type: 'success');
    } catch (e) {
      _addLog('[Service] #$currentNo 테스트 출력 실패: $e', type: 'error');
      rethrow;
    }
  }

  Future<void> _sendToPrinter(String ip, int port, List<int> data) async {
    Socket? socket;
    try {
      socket = await Socket.connect(ip, port, timeout: const Duration(seconds: 5));
      socket.add(data);
      await socket.flush();
    } finally {
      await socket?.close();
    }
  }

  static const _corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, Content-Type, Accept, Authorization',
    'Content-Type': 'application/json',
  };

  void dispose() {
    _logController.close();
  }
}
