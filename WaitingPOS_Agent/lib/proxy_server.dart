import 'dart:convert';
import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';
import 'database_helper.dart';

class ProxyServer {
  HttpServer? _server;
  final int port = 8000;
  void Function(String)? onLog;
  final DatabaseHelper _dbHelper = DatabaseHelper();

  ProxyServer({this.onLog});

  Future<void> _log(String message) async {
    final timestamp = DateTime.now().toString().split('.').first.split(' ').last;
    final logMessage = '[$timestamp] $message';
    print(logMessage);
    
    // Save to database
    await _dbHelper.insertLog(logMessage);
    
    onLog?.call(logMessage);
  }

  // Start the server
  Future<void> start() async {
    if (_server != null) return;

    final router = Router();

    // Health check endpoint
    router.get('/', (Request request) {
      _log('Health check received');
      return Response.ok('Waiting Print Proxy is Running! (Flutter)');
    });

    // Handle print request
    router.post('/print', (Request request) async {
      try {
        final payload = await request.readAsString();
        final Map<String, dynamic> body = jsonDecode(payload);
        
        final String ip = body['ip'] ?? 'Unknown';
        final int port = body['port'] ?? 9100;
        
        final String waitingNo = (body['waiting_no'] ?? body['waitingNo'] ?? '-').toString();
        final String seqNo = (body['seq_no'] ?? body['seq'] ?? '-').toString();
        final String name = (body['name'] ?? body['customer_name'] ?? '-').toString();
        final String phone = (body['phone'] ?? body['hp'] ?? body['customer_hp'] ?? '-').toString();

        _log('▶ [PRINT REQUEST] IP: $ip:$port');
        String waitingInfo = 'No: $waitingNo, Seq: $seqNo, Name: $name, HP: $phone';
        _log('📋 [WAITING INFO] $waitingInfo');
        
        final List<dynamic> dataDynamic = body['data'] ?? [];
        final List<int> data = dataDynamic.cast<int>();

        // Check for double cutting commands
        _analyzeCommands(data);

        // Save for reprint
        await _dbHelper.insertPrintJob(ip, port, data, waitingInfo);

        await _sendToPrinter(ip, port, data);

        return Response.ok(
          jsonEncode({'status': 'success'}),
          headers: _corsHeaders,
        );
      } catch (e) {
        _log('❌ Error processing request: $e');
        return Response.internalServerError(
          body: 'Error: $e',
          headers: _corsHeaders,
        );
      }
    });

    // Handle OPTIONS for CORS
    router.options('/print', (Request request) {
      return Response.ok('', headers: _corsHeaders);
    });

    // Add CORS middleware
    final handler = Pipeline()
        .addMiddleware(logRequests(logger: (msg, isError) => _log(msg)))
        .addHandler(router.call);

    // Bind to any IPv4 address
    _server = await shelf_io.serve(handler, InternetAddress.anyIPv4, port);
    _log('🚀 Serving at http://${_server!.address.host}:${_server!.port}');
  }

  // Stop the server
  Future<void> stop() async {
    await _server?.close();
    _server = null;
    _log('⏹ Server stopped.');
  }

  bool get isRunning => _server != null;

  void _analyzeCommands(List<int> data) {
    int cutCount = 0;
    for (int i = 0; i < data.length - 1; i++) {
      // Pattern: GS V (29, 86)
      if (data[i] == 29 && data[i + 1] == 86) {
        cutCount++;
      }
      // Pattern: ESC i (27, 105)
      else if (data[i] == 27 && data[i + 1] == 105) {
        cutCount++;
      }
      // Pattern: ESC m (27, 109)
      else if (data[i] == 27 && data[i + 1] == 109) {
        cutCount++;
      }
    }

    if (cutCount > 1) {
      _log('⚠️ [DUPLICATE CUT] Found $cutCount cutting commands in data!');
    } else if (cutCount == 1) {
      _log('✂️ [CUT COMMAND] 1 cutting command found.');
    } else {
      _log('📄 [NO CUT] No cutting command found.');
    }
  }

  // Send data to printer via TCP
  Future<void> _sendToPrinter(String ip, int port, List<int> data) async {
    _log('🔌 Connecting to Printer $ip:$port');
    _log('📤 Sending print data (${data.length} bytes)');

    Socket? socket;
    try {
      socket = await Socket.connect(ip, port, timeout: Duration(seconds: 5));
      socket.add(data);
      await socket.flush();
      _log('✅ Data sent successfully to $ip');
    } catch (e) {
      _log('⚠️ Printer error ($ip): $e');
      rethrow;
    } finally {
      await socket?.close();
    }
  }

  // Static method for reprinting
  Future<void> reprint(String ip, int port, List<int> data) async {
    await _sendToPrinter(ip, port, data);
  }

  // CORS Headers
  static const _corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json',
  };
}
