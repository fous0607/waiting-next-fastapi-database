import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;

  factory DatabaseHelper() => _instance;

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'logs.db');
    return await openDatabase(
      path,
      version: 2, // Upgraded version
      onCreate: (db, version) async {
        await db.execute(
          'CREATE TABLE logs(id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)',
        );
        await db.execute(
          'CREATE TABLE print_jobs(id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, port INTEGER, data BLOB, waiting_info TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)',
        );
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute(
            'CREATE TABLE print_jobs(id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, port INTEGER, data BLOB, waiting_info TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)',
          );
        }
      },
    );
  }

  Future<void> insertLog(String message) async {
    final db = await database;
    await db.insert('logs', {'message': message});
    await db.delete('logs', where: "timestamp < datetime('now', '-30 days')");
  }

  Future<List<Map<String, dynamic>>> getLogs() async {
    final db = await database;
    return await db.query('logs', orderBy: 'timestamp DESC');
  }

  Future<void> clearLogs() async {
    final db = await database;
    await db.delete('logs');
  }

  // Print Jobs methods
  Future<void> insertPrintJob(String ip, int port, List<int> data, String waitingInfo) async {
    final db = await database;
    await db.insert('print_jobs', {
      'ip': ip,
      'port': port,
      'data': data,
      'waiting_info': waitingInfo,
    });
    // Keep only last 20 jobs to save space
    await db.execute('DELETE FROM print_jobs WHERE id NOT IN (SELECT id FROM print_jobs ORDER BY timestamp DESC LIMIT 20)');
  }

  Future<Map<String, dynamic>?> getLastPrintJob() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('print_jobs', orderBy: 'timestamp DESC', limit: 1);
    if (maps.isNotEmpty) return maps.first;
    return null;
  }
}
