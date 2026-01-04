import 'dart:convert';
import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';

class ProxyServer {
  HttpServer? _server;
  final int port = 8000;
  void Function(String)? onLog;

  ProxyServer({this.onLog});

  void _log(String message) {
    final timestamp = DateTime.now().toString().split('.').first.split(' ').last;
    final logMessage = '[$timestamp] $message';
    print(logMessage);
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
        _log('Received print request');
        
        final Map<String, dynamic> body = jsonDecode(payload);
        final String ip = body['ip'];
        final int port = body['port'] ?? 9100;
        final List<dynamic> dataDynamic = body['data'];
        final List<int> data = dataDynamic.cast<int>();

        await _sendToPrinter(ip, port, data);

        return Response.ok(
          jsonEncode({'status': 'success'}),
          headers: _corsHeaders,
        );
      } catch (e) {
        _log('Error processing request: $e');
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
    _log('Serving at http://${_server!.address.host}:${_server!.port}');
  }

  // Stop the server
  Future<void> stop() async {
    await _server?.close();
    _server = null;
    _log('Server stopped.');
  }

  bool get isRunning => _server != null;

  // Send data to printer via TCP
  Future<void> _sendToPrinter(String ip, int port, List<int> data) async {
    _log('Connecting to Printer $ip:$port');
    Socket? socket;
    try {
      socket = await Socket.connect(ip, port, timeout: Duration(seconds: 5));
      socket.add(data);
      await socket.flush();
      _log('Data sent successfully to $ip');
    } catch (e) {
      _log('Printer error ($ip): $e');
      rethrow;
    } finally {
      await socket?.close();
    }
  }

  // CORS Headers
  static const _corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json',
  };
}
